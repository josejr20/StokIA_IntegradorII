const { Decimal } = require('decimal.js');
const { v4: uuidv4 } = require('uuid');
const { Lote, MovimientoInventario, Producto } = require('../models');
const config = require('../config');
const logger = require('../utils/logger');

const registrarMovimiento = async (loteId, tipo, cantidad, origen = 'otro', motivo = '', precioUnitario = null, usuarioId = null) => {
  if (!['ingreso', 'salida', 'ajuste'].includes(tipo)) throw new Error('Tipo de movimiento no válido');

  const cantidadDec = new Decimal(String(cantidad));
  if (!cantidadDec.isFinite() || cantidadDec.lte(0)) throw new Error('La cantidad debe ser mayor a 0');

  const lote = await Lote.findByPk(loteId);
  if (!lote) throw new Error('Lote no encontrado');

  const producto = await Producto.findByPk(lote.producto_id);
  if (!producto) throw new Error('Producto no encontrado');
  if (!producto.activo && tipo !== 'salida') throw new Error('No se puede registrar stock para un producto inactivo');
  if (tipo !== 'ingreso' && Number(lote.cantidad_actual) < Number(cantidad)) throw new Error('Stock insuficiente para registrar la salida');

  const ultimo = await MovimientoInventario.findOne({
    where: {},
    include: [{ model: Lote, as: 'lote', where: { producto_id: lote.producto_id }, attributes: [] }],
    order: [['fecha', 'DESC'], ['id', 'DESC']]
  });

  const saldoCantidadPrevio = ultimo ? new Decimal(String(ultimo.saldo_cantidad)) : new Decimal('0');
  const saldoValorizadoPrevio = ultimo ? new Decimal(String(ultimo.saldo_valorizado)) : new Decimal('0');
  const costoPromedioPrevio = ultimo ? new Decimal(String(ultimo.saldo_precio_unitario)) : new Decimal('0');

  let precioUnit, precioTotal, saldoCantidad, saldoValorizado;

  if (tipo === 'ingreso') {
    precioUnit = precioUnitario ? new Decimal(String(precioUnitario)) : costoPromedioPrevio;
    precioTotal = cantidadDec.times(precioUnit);
    saldoCantidad = saldoCantidadPrevio.plus(cantidadDec);
    saldoValorizado = saldoValorizadoPrevio.plus(precioTotal);
    lote.cantidad_actual = (new Decimal(String(lote.cantidad_actual))).plus(cantidadDec).toNumber();
    await lote.save({ fields: ['cantidad_actual'] });
  } else {
    precioUnit = costoPromedioPrevio;
    precioTotal = cantidadDec.times(precioUnit);
    saldoCantidad = saldoCantidadPrevio.minus(cantidadDec);
    saldoValorizado = saldoValorizadoPrevio.minus(precioTotal);
    lote.cantidad_actual = (new Decimal(String(lote.cantidad_actual))).minus(cantidadDec).toNumber();
    await lote.save({ fields: ['cantidad_actual'] });
  }

  const saldoCostoPromedio = saldoCantidad.gt(0) ? saldoValorizado.dividedBy(saldoCantidad) : new Decimal('0');

  const movimiento = await MovimientoInventario.create({
    lote_id: loteId,
    tipo,
    origen,
    cantidad: cantidadDec.toNumber(),
    precio_unitario: precioUnit.toNumber(),
    precio_total: precioTotal.toNumber(),
    saldo_cantidad: saldoCantidad.toNumber(),
    saldo_precio_unitario: saldoCostoPromedio.toNumber(),
    saldo_valorizado: saldoValorizado.toNumber(),
    motivo,
    usuario_id: usuarioId
  });

  logger.info(`Movimiento registrado: ${tipo}/${origen} - Lote: ${loteId}`);
  return movimiento;
};

module.exports = { registrarMovimiento };
