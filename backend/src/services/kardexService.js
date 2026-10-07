const { Decimal } = require('decimal.js');
const { Lote, MovimientoInventario, Producto } = require('../models');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

class ErrorKardex extends Error {}

const ORIGENES_VALIDOS = ['compra', 'venta', 'inicial', 'ajuste', 'devolucion', 'anulacion', 'otro'];

const registrarMovimiento = async (loteId, tipo, cantidad, origen = 'otro', motivo = '', precioUnitario = null, usuarioId = null, transaction = null, fecha = new Date()) => {
  if (!transaction) {
    const transaccion = await Lote.sequelize.transaction();
    try {
      const resultado = await registrarMovimiento(
        loteId, tipo, cantidad, origen, motivo, precioUnitario, usuarioId, transaccion, fecha,
      );
      await transaccion.commit();
      return resultado;
    } catch (error) {
      await transaccion.rollback();
      throw error;
    }
  }

  if (!['ingreso', 'salida'].includes(tipo)) throw new ErrorKardex('Tipo de movimiento no válido. Use "ingreso" o "salida"');
  if (!ORIGENES_VALIDOS.includes(origen)) throw new ErrorKardex('Origen de movimiento no válido');

  let cantidadDec;
  try {
    cantidadDec = new Decimal(String(cantidad));
  } catch {
    throw new ErrorKardex('La cantidad debe ser un número válido');
  }
  if (!cantidadDec.isFinite() || cantidadDec.lte(0)) throw new ErrorKardex('La cantidad debe ser mayor a 0');
  if (cantidadDec.decimalPlaces() > 2) throw new ErrorKardex('La cantidad admite hasta 2 decimales');
  const fechaMovimiento = new Date(fecha);
  if (Number.isNaN(fechaMovimiento.getTime())) throw new ErrorKardex('La fecha del movimiento es inválida');
  let precioIngresado = null;
  if (precioUnitario !== null && precioUnitario !== undefined && precioUnitario !== '') {
    try {
      precioIngresado = new Decimal(String(precioUnitario));
    } catch {
      throw new ErrorKardex('El precio unitario debe ser un número válido');
    }
  }
  if (precioIngresado && (!precioIngresado.isFinite() || precioIngresado.lt(0))) {
    throw new ErrorKardex('El precio unitario debe ser mayor o igual a 0');
  }
  if (precioIngresado && precioIngresado.decimalPlaces() > 2) {
    throw new ErrorKardex('El precio unitario admite hasta 2 decimales');
  }

  const loteInicial = await Lote.findByPk(loteId, { transaction });
  if (!loteInicial) throw new ErrorKardex('Lote no encontrado');

  const producto = await Producto.findByPk(loteInicial.producto_id, {
    transaction,
    lock: transaction ? transaction.LOCK.UPDATE : undefined,
  });
  if (!producto) throw new ErrorKardex('Producto no encontrado');
  if (!producto.activo) throw new ErrorKardex('No se puede registrar movimientos para un producto inactivo');
  const lote = await Lote.findByPk(loteId, {
    transaction,
    lock: transaction ? transaction.LOCK.UPDATE : undefined,
  });
  if (!lote) throw new ErrorKardex('Lote no encontrado');
  const cantidadActual = new Decimal(String(lote.cantidad_actual));
  if (tipo !== 'ingreso' && cantidadActual.lt(cantidadDec)) throw new ErrorKardex('Stock insuficiente para registrar la salida');

  const diferencia = tipo === 'ingreso' ? cantidadDec : cantidadDec.negated();
  lote.cantidad_actual = cantidadActual.plus(diferencia).toNumber();
  await lote.save({ fields: ['cantidad_actual'], transaction });

  const movimiento = await MovimientoInventario.create({
    lote_id: loteId,
    tipo,
    origen,
    cantidad: cantidadDec.toNumber(),
    precio_unitario: precioIngresado?.toNumber() ?? null,
    costo_unitario_manual: tipo === 'ingreso' && precioIngresado !== null,
    precio_total: null,
    saldo_cantidad: 0,
    saldo_precio_unitario: 0,
    saldo_valorizado: 0,
    motivo,
    usuario_id: usuarioId,
    fecha: fechaMovimiento,
  }, { transaction });

  // HU8.2: Optimización - si el nuevo movimiento es posterior o igual al último,
  // recalcular solo desde el último; si es retroactivo, recalcular todo.
  const ultimoMovimiento = await MovimientoInventario.findOne({
    include: [{
      model: Lote,
      as: 'lote',
      attributes: [],
      where: { producto_id: lote.producto_id },
    }],
    order: [['fecha', 'DESC'], ['id', 'DESC']],
    transaction,
  });

  const esRetroactivo = ultimoMovimiento && new Date(ultimoMovimiento.fecha) > fechaMovimiento;

  let whereCond = {
    include: [{
      model: Lote,
      as: 'lote',
      attributes: [],
      where: { producto_id: lote.producto_id },
    }],
    order: [['fecha', 'ASC'], ['id', 'ASC']],
    transaction,
    lock: transaction ? transaction.LOCK.UPDATE : undefined,
  };

  let saldoCantidad = new Decimal('0');
  let saldoValorizado = new Decimal('0');

  if (!esRetroactivo && ultimoMovimiento) {
    // Cargar solo el último movimiento para obtener su saldo
    const ultimo = await MovimientoInventario.findByPk(ultimoMovimiento.id, { transaction });
    if (ultimo) {
      saldoCantidad = new Decimal(String(ultimo.saldo_cantidad ?? 0));
      saldoValorizado = new Decimal(String(ultimo.saldo_valorizado ?? 0));
    }
    // Filtrar movimientos desde el último (incluyendo el nuevo)
    whereCond.where = {
      ...whereCond.where,
      [Op.or]: [
        { fecha: { [Op.gt]: ultimoMovimiento.fecha } },
        { [Op.and]: [{ fecha: ultimoMovimiento.fecha }, { id: { [Op.gte]: ultimoMovimiento.id } }] }
      ]
    };
  }

  const movimientos = await MovimientoInventario.findAll(whereCond);

  for (const fila of movimientos) {
    const cantidadFila = new Decimal(String(fila.cantidad));
    let precioUnitarioFila;
    if (fila.tipo === 'ingreso') {
      precioUnitarioFila = fila.costo_unitario_manual && fila.precio_unitario !== null
        ? new Decimal(String(fila.precio_unitario))
        : saldoCantidad.gt(0) ? saldoValorizado.dividedBy(saldoCantidad).toDecimalPlaces(2) : new Decimal('0');
      precioUnitarioFila = precioUnitarioFila.toDecimalPlaces(2);
      saldoValorizado = saldoValorizado.plus(
        cantidadFila.times(precioUnitarioFila).toDecimalPlaces(2),
      );
      saldoCantidad = saldoCantidad.plus(cantidadFila);
    } else {
      precioUnitarioFila = saldoCantidad.gt(0)
        ? saldoValorizado.dividedBy(saldoCantidad).toDecimalPlaces(2)
        : new Decimal('0');
      saldoValorizado = saldoValorizado.minus(
        cantidadFila.times(precioUnitarioFila).toDecimalPlaces(2),
      );
      saldoCantidad = saldoCantidad.minus(cantidadFila);
    }

    if (saldoCantidad.lt(0)) {
      throw new ErrorKardex('El movimiento produciría un saldo histórico negativo');
    }
    const saldoCostoPromedio = saldoCantidad.gt(0)
      ? saldoValorizado.dividedBy(saldoCantidad)
      : new Decimal('0');
    await fila.update({
      precio_unitario: precioUnitarioFila.toDecimalPlaces(2).toNumber(),
      precio_total: cantidadFila.times(precioUnitarioFila).toDecimalPlaces(2).toNumber(),
      saldo_cantidad: saldoCantidad.toDecimalPlaces(2).toNumber(),
      saldo_precio_unitario: saldoCostoPromedio.toDecimalPlaces(2).toNumber(),
      saldo_valorizado: saldoValorizado.toDecimalPlaces(2).toNumber(),
    }, { transaction });
  }

  logger.info(`Movimiento registrado: ${tipo}/${origen} - Lote: ${loteId}`);
  await movimiento.reload({ transaction });
  return movimiento;
};

module.exports = { ErrorKardex, registrarMovimiento };
