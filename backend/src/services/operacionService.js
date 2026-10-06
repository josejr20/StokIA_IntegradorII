const { Decimal } = require('decimal.js');
const { Op } = require('sequelize');
const {
  Operacion,
  OperacionDetalle,
  Comprobante,
  Configuracion,
  Cliente,
  Producto,
  Lote,
  Venta,
  Auditoria,
  Usuario,
} = require('../models');
const { ErrorKardex, registrarMovimiento } = require('./kardexService');
const { seleccionarLotesFEFO, diasHastaVencimiento } = require('./loteService');

/**
 * Errores de negocio: el controlador los devuelve como 400.
 * Cualquier otro error se considera de servidor.
 */
class ErrorOperacion extends Error {}

const PREFIJO_OPERACION = { venta: 'V', devolucion: 'D', ajuste: 'A' };
const PREFIJO_COMPROBANTE = { boleta: 'B', factura: 'F', nota_credito: 'NC' };
const TIPO_COMPROBANTE = { venta: 'boleta', devolucion: 'nota_credito' };

const DOS_LUGARES = Decimal.ROUND_HALF_UP;
const PLAZO_ANULACION_MS = 2 * 24 * 60 * 60 * 1000;

function puedeAnularOperacion(operacion, ahora = Date.now()) {
  const fechaCreacion = new Date(operacion.fecha_creacion).getTime();
  const tiempoTranscurrido = ahora - fechaCreacion;
  return Number.isFinite(fechaCreacion)
    && tiempoTranscurrido >= 0
    && tiempoTranscurrido < PLAZO_ANULACION_MS;
}

/** Decimal tolerante: null/undefined/'' se leen como 0 y validan después. */
function decimalDe(valor) {
  if (valor === null || valor === undefined || valor === '') return new Decimal('0');
  try {
    return new Decimal(String(valor));
  } catch {
    return new Decimal(Number.NaN);
  }
}

function numeroDe(prefijo, id) {
  return `${prefijo}-${String(id).padStart(6, '0')}`;
}

async function leerImpuesto(transaction) {
  const fila = await Configuracion.findOne({
    where: { clave: 'impuesto_porcentaje' },
    transaction,
  });
  if (!fila) return new Decimal('0');
  const valor = new Decimal(String(fila.valor));
  return valor.isFinite() && valor.gte(0) ? valor : new Decimal('0');
}

/**
 * subtotal = suma(cantidad x precio); impuesto = subtotal x porcentaje / 100.
 * En 0 significa "no configurado": el comprobante no muestra la línea.
 */
function calcularTotales(lineas, impuestoPorcentaje) {
  const subtotal = lineas.reduce(
    (acum, linea) => acum.plus(linea.cantidad.times(linea.precio_unitario)),
    new Decimal('0'),
  ).toDecimalPlaces(2, DOS_LUGARES);
  const impuesto = impuestoPorcentaje.gt(0)
    ? subtotal.times(impuestoPorcentaje).dividedBy(100).toDecimalPlaces(2, DOS_LUGARES)
    : new Decimal('0');
  return {
    subtotal,
    impuesto,
    total: subtotal.plus(impuesto).toDecimalPlaces(2, DOS_LUGARES),
  };
}

function validarCliente(cliente, requerido) {
  if (!cliente) {
    if (requerido) throw new ErrorOperacion('Debe seleccionar un cliente');
    return null;
  }
  if (!cliente.activo) throw new ErrorOperacion('El cliente seleccionado está inactivo');
  return cliente;
}

/** Normaliza y valida las líneas de productos de una venta/devolución. */
async function prepararLineas(items, { transaction, precioDesdeVenta = null } = {}) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ErrorOperacion('La operación debe tener al menos un producto');
  }

  const ids = [...new Set(items.map((item) => Number(item.producto_id)))];
  if (ids.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw new ErrorOperacion('Producto inválido en la operación');
  }

  const productos = await Producto.findAll({ where: { id: ids }, transaction });
  if (productos.length !== ids.length) {
    throw new ErrorOperacion('Uno o más productos no existen');
  }
  const porId = new Map(productos.map((p) => [p.id, p]));
  for (const producto of productos) {
    if (!producto.activo) {
      throw new ErrorOperacion(`El producto ${producto.codigo} está inactivo`);
    }
  }

  const lineas = [];
  for (const item of items) {
    const producto = porId.get(Number(item.producto_id));
    if (!producto) throw new ErrorOperacion('Producto inexistente en la operación');

    const cantidad = decimalDe(item.cantidad);
    if (!cantidad.isFinite() || cantidad.lte(0)) {
      throw new ErrorOperacion(`La cantidad de ${producto.codigo} debe ser mayor a 0`);
    }

    let precio = item.precio_unitario === null || item.precio_unitario === undefined || item.precio_unitario === ''
      ? null
      : decimalDe(item.precio_unitario);
    if (precio === null) {
      const heredado = precioDesdeVenta ? precioDesdeVenta(producto.id) : null;
      precio = heredado && heredado.gt(0)
        ? heredado
        : new Decimal(String(producto.precio_venta ?? 0));
    }
    if (!precio.isFinite() || precio.lt(0)) {
      throw new ErrorOperacion(`El precio de ${producto.codigo} es inválido`);
    }
    if (cantidad.decimalPlaces() > 2 || precio.decimalPlaces() > 2) {
      throw new ErrorOperacion(`La cantidad y el precio de ${producto.codigo} admiten hasta 2 decimales`);
    }
    const cantidadNormalizada = cantidad.toDecimalPlaces(2, DOS_LUGARES);
    if (cantidadNormalizada.lte(0)) {
      throw new ErrorOperacion(`La cantidad de ${producto.codigo} debe ser mayor a 0`);
    }

    lineas.push({
      producto_id: producto.id,
      producto,
      cantidad: cantidadNormalizada,
      precio_unitario: precio.toDecimalPlaces(2, DOS_LUGARES),
      lote_id: item.lote_id ? Number(item.lote_id) : null,
    });
  }
  return lineas;
}

/**
 * Reparte la cantidad de una línea entre lotes. Si la línea indica un lote,
 * ese lote debe cubrir toda la cantidad; si no, se usa FEFO.
 * Devuelve las asignaciones { lote, cantidad } y valida el stock.
 */
async function crearLoteAjuste(linea, transaction, fecha) {
  const ultimoId = await Lote.max('id', {
    where: { producto_id: linea.producto_id },
    transaction,
  }) || 0;
  const lote = await Lote.create({
    producto_id: linea.producto_id,
    numero_lote: `AJ-${String(ultimoId + 1).padStart(6, '0')}`,
    cantidad_inicial: linea.cantidad.toNumber(),
    cantidad_actual: 0,
    fecha_ingreso: fecha,
    fecha_vencimiento: null,
  }, { transaction });
  return [{ lote, cantidad: linea.cantidad }];
}

async function asignarLotes(linea, {
  transaction,
  soloLoteNoVencido = false,
  crearLoteParaAjuste = false,
  habilitarStockInicial = false,
  fecha = new Date(),
  usuario_id = null,
} = {}) {
  const asignaciones = [];

  if (linea.lote_id) {
    const lote = await Lote.findByPk(linea.lote_id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!lote || lote.producto_id !== linea.producto_id) {
      throw new ErrorOperacion(`El lote indicado no corresponde a ${linea.producto.codigo}`);
    }
    const disponible = new Decimal(String(lote.cantidad_actual));
    if (soloLoteNoVencido && diasHastaVencimiento(lote.fecha_vencimiento, fecha) < 0) {
      throw new ErrorOperacion(`El lote de ${linea.producto.codigo} está vencido`);
    }
    if (disponible.lt(linea.cantidad) && !crearLoteParaAjuste) {
      throw new ErrorOperacion(
        `Stock insuficiente en el lote de ${linea.producto.codigo} (hay ${disponible})`,
      );
    }
    asignaciones.push({ lote, cantidad: linea.cantidad });
    return asignaciones;
  }

  if (crearLoteParaAjuste) {
    return crearLoteAjuste(linea, transaction, new Date(fecha).toISOString().slice(0, 10));
  }

  const lotesEncontrados = await Lote.findAll({
    where: { producto_id: linea.producto_id, cantidad_actual: { [Op.gt]: 0 } },
    order: [['fecha_vencimiento', 'ASC'], ['id', 'ASC']],
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  const lotes = soloLoteNoVencido
    ? seleccionarLotesFEFO(lotesEncontrados, fecha)
    : lotesEncontrados;

  let restante = linea.cantidad;
  for (const lote of lotes) {
    if (restante.lte(0)) break;
    const disponible = new Decimal(String(lote.cantidad_actual));
    const cantidad = Decimal.min(disponible, restante);
    if (cantidad.gt(0)) {
      asignaciones.push({ lote, cantidad });
      restante = restante.minus(cantidad);
    }
  }
  if (restante.gt(0) && habilitarStockInicial) {
    const fechaIngreso = new Date(fecha);
    const ultimoId = await Lote.max('id', {
      where: { producto_id: linea.producto_id },
      transaction,
    }) || 0;
    const loteInicial = await Lote.create({
      producto_id: linea.producto_id,
      numero_lote: `IN-${String(ultimoId + 1).padStart(6, '0')}`,
      cantidad_inicial: restante.toNumber(),
      cantidad_actual: 0,
      fecha_ingreso: fechaIngreso.toISOString().slice(0, 10),
      fecha_vencimiento: null,
    }, { transaction });
    await registrarMovimiento(
      loteInicial.id,
      'ingreso',
      restante.toNumber(),
      'inicial',
      'Apertura de stock para importar historial',
      0,
      usuario_id,
      transaction,
      fechaIngreso,
    );
    asignaciones.push({ lote: loteInicial, cantidad: restante });
    restante = new Decimal('0');
  }
  if (restante.gt(0)) {
    throw new ErrorOperacion(
      `Stock insuficiente para ${linea.producto.codigo} (faltan ${restante})`,
    );
  }
  return asignaciones;
}

/** Snapshot del comprobante: todo lo que muestra la factura, congelado al momento. */
function construirDatosComprobante({ operacion, cliente, usuario, asignaciones, tipoComprobante, operacionOrigen }) {
  return {
    numero_operacion: operacion.numero,
    numero_comprobante: operacion.numero_comprobante,
    tipo_comprobante: tipoComprobante,
    fecha: operacion.fecha,
    cliente: cliente
      ? { id: cliente.id, nombre: cliente.nombre, documento: cliente.documento || null }
      : null,
    vendedor: usuario
      ? { id: usuario.id, nombres: usuario.nombres, apellidos: usuario.apellidos, email: usuario.email }
      : null,
    items: asignaciones.map((asignacion) => ({
      producto_id: asignacion.linea.producto_id,
      codigo: asignacion.linea.producto.codigo,
      producto: asignacion.linea.producto.nombre,
      cantidad: asignacion.cantidad.toNumber(),
      precio_unitario: asignacion.linea.precio_unitario.toNumber(),
      subtotal: asignacion.subtotal.toNumber(),
      lote_id: asignacion.lote.id,
    })),
    subtotal: Number(operacion.subtotal),
    impuesto_porcentaje: Number(operacion.impuesto_porcentaje),
    impuesto: Number(operacion.impuesto),
    total: Number(operacion.total),
    motivo: operacion.motivo || null,
    operacion_origen: operacionOrigen
      ? { id: operacionOrigen.id, numero: operacionOrigen.numero, fecha: operacionOrigen.fecha }
      : null,
  };
}

function fechaIsoValida(...valores) {
  for (const valor of valores) {
    if (!valor) continue;
    const fecha = new Date(valor);
    if (Number.isFinite(fecha.getTime())) return fecha.toISOString();
  }
  return null;
}

function reconstruirDatosComprobante(operacion, comprobante, ventas = [], usuario = null) {
  const datosOriginales = comprobante.datos && typeof comprobante.datos === 'object'
    ? comprobante.datos
    : {};
  const operacionLegada = datosOriginales.operacion && typeof datosOriginales.operacion === 'object'
    ? datosOriginales.operacion
    : {};
  const detalles = operacion.detalles || [];
  const itemsOriginales = Array.isArray(datosOriginales.items) ? datosOriginales.items : [];
  const items = detalles.map((detalle) => {
    const producto = detalle.producto || {};
    const itemOriginal = itemsOriginales.find((item) =>
      Number(item.producto_id) === Number(detalle.producto_id)
      && (item.lote_id == null || Number(item.lote_id) === Number(detalle.lote_id)),
    ) || {};
    const ventaOriginal = ventas.find((venta) =>
      Number(venta.producto_id) === Number(detalle.producto_id)
      && (venta.lote_id == null || Number(venta.lote_id) === Number(detalle.lote_id))
      && Number(venta.cantidad) > 0
      && !['devolucion', 'anulacion'].includes(venta.origen),
    );
    const precioUnitario = [
      detalle.precio_unitario,
      ventaOriginal?.precio_unitario,
      itemOriginal.precio_unitario,
      producto.precio_venta,
    ].map((valor) => decimalDe(valor))
      .find((valor) => valor.isFinite() && valor.gt(0)) || new Decimal('0');
    const cantidad = decimalDe(detalle.cantidad);
    const subtotalOriginal = decimalDe(detalle.subtotal);
    const subtotal = subtotalOriginal.isFinite() && subtotalOriginal.gt(0)
      ? subtotalOriginal
      : cantidad.times(precioUnitario).toDecimalPlaces(2, DOS_LUGARES);

    return {
      ...itemOriginal,
      producto_id: Number(detalle.producto_id),
      codigo: producto.codigo || itemOriginal.codigo || `P-${detalle.producto_id}`,
      producto: producto.nombre || itemOriginal.producto || `Producto ${detalle.producto_id}`,
      cantidad: cantidad.toNumber(),
      precio_unitario: precioUnitario.toDecimalPlaces(2, DOS_LUGARES).toNumber(),
      subtotal: subtotal.toDecimalPlaces(2, DOS_LUGARES).toNumber(),
      lote_id: detalle.lote_id ?? itemOriginal.lote_id ?? null,
    };
  });
  const subtotalCalculado = items.reduce(
    (total, item) => total.plus(String(item.subtotal)),
    new Decimal('0'),
  ).toDecimalPlaces(2, DOS_LUGARES);
  const subtotalGuardado = decimalDe(operacion.subtotal);
  const subtotal = subtotalGuardado.isFinite() && subtotalGuardado.gt(0)
    ? subtotalGuardado
    : subtotalCalculado;
  const impuestoPorcentaje = decimalDe(operacion.impuesto_porcentaje);
  const impuestoGuardado = decimalDe(operacion.impuesto);
  const impuesto = impuestoGuardado.isFinite() && impuestoGuardado.gt(0)
    ? impuestoGuardado
    : subtotal.times(impuestoPorcentaje).div(100).toDecimalPlaces(2, DOS_LUGARES);
  const totalGuardado = decimalDe(operacion.total);
  const total = totalGuardado.isFinite() && totalGuardado.gt(0)
    ? totalGuardado
    : subtotal.plus(impuesto).toDecimalPlaces(2, DOS_LUGARES);
  const ventaConFecha = ventas.find((venta) => fechaIsoValida(venta.fecha_venta));
  const fecha = fechaIsoValida(
    datosOriginales.fecha,
    operacionLegada.fecha,
    operacion.fecha,
    ventaConFecha?.fecha_venta,
    operacion.fecha_creacion,
    comprobante.fecha_creacion,
  );
  const vendedor = usuario
    || operacion.usuario
    || datosOriginales.vendedor
    || datosOriginales.usuario
    || {};

  return {
    ...datosOriginales,
    numero_operacion: operacion.numero
      || datosOriginales.numero_operacion
      || operacionLegada.numero
      || `OP-${operacion.id}`,
    numero_comprobante: comprobante.numero || datosOriginales.numero_comprobante || '',
    tipo_comprobante: comprobante.tipo || datosOriginales.tipo_comprobante || 'boleta',
    fecha,
    cliente: operacion.cliente
      ? {
        id: operacion.cliente.id,
        nombre: operacion.cliente.nombre,
        documento: operacion.cliente.documento || null,
      }
      : datosOriginales.cliente || null,
    vendedor: vendedor.id
      ? {
        id: vendedor.id,
        nombres: vendedor.nombres || '',
        apellidos: vendedor.apellidos || '',
        email: vendedor.email || '',
      }
      : datosOriginales.vendedor || null,
    items,
    subtotal: subtotal.toNumber(),
    impuesto_porcentaje: impuestoPorcentaje.isFinite() ? impuestoPorcentaje.toNumber() : 0,
    impuesto: impuesto.toNumber(),
    total: total.toNumber(),
    motivo: operacion.motivo || datosOriginales.motivo || operacionLegada.motivo || null,
    operacion_origen: operacion.operacionOrigen
      ? {
        id: operacion.operacionOrigen.id,
        numero: operacion.operacionOrigen.numero,
        fecha: fechaIsoValida(operacion.operacionOrigen.fecha),
      }
      : datosOriginales.operacion_origen || null,
  };
}

function distribuirSubtotales(asignaciones) {
  const asignacionesPorLinea = new Map();
  for (const asignacion of asignaciones) {
    const grupo = asignacionesPorLinea.get(asignacion.linea) || [];
    grupo.push(asignacion);
    asignacionesPorLinea.set(asignacion.linea, grupo);
  }

  for (const [linea, grupo] of asignacionesPorLinea) {
    const subtotalLinea = linea.cantidad.times(linea.precio_unitario).toDecimalPlaces(2, DOS_LUGARES);
    const asignado = grupo.reduce((total, asignacion) => {
      asignacion.subtotal = asignacion.cantidad.times(linea.precio_unitario).toDecimalPlaces(2, DOS_LUGARES);
      return total.plus(asignacion.subtotal);
    }, new Decimal('0'));
    grupo[grupo.length - 1].subtotal = grupo[grupo.length - 1].subtotal.plus(subtotalLinea.minus(asignado));
  }
}

async function asignarDevolucion(lineas, operacionOrigen, transaction) {
  const detallesOrigen = await OperacionDetalle.findAll({
    where: { operacion_id: operacionOrigen.id },
    order: [['id', 'ASC']],
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  const productosOrigen = new Set(detallesOrigen.map((detalle) => Number(detalle.producto_id)));
  if (lineas.some((linea) => !productosOrigen.has(linea.producto_id))) {
    throw new ErrorOperacion('La devolución incluye productos que no están en la venta original');
  }

  const devolucionesPrevias = await Operacion.findAll({
    where: {
      operacion_origen_id: operacionOrigen.id,
      tipo: 'devolucion',
      estado: 'activa',
    },
    attributes: ['id'],
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  const idsDevoluciones = devolucionesPrevias.map((devolucion) => devolucion.id);
  const detallesDevueltos = idsDevoluciones.length
    ? await OperacionDetalle.findAll({
      where: { operacion_id: { [Op.in]: idsDevoluciones } },
      transaction,
      lock: transaction.LOCK.UPDATE,
    })
    : [];

  const llave = (productoId, loteId) => `${productoId}:${loteId ?? 'sin-lote'}`;
  const cantidadesVendidas = new Map();
  const preciosVenta = new Map();
  for (const detalle of detallesOrigen) {
    const key = llave(detalle.producto_id, detalle.lote_id);
    cantidadesVendidas.set(
      key,
      (cantidadesVendidas.get(key) || new Decimal('0')).plus(String(detalle.cantidad)),
    );
    if (!preciosVenta.has(Number(detalle.producto_id))) {
      preciosVenta.set(Number(detalle.producto_id), new Decimal(String(detalle.precio_unitario)));
    }
  }
  const cantidadesDevueltas = new Map();
  for (const detalle of detallesDevueltos) {
    const key = llave(detalle.producto_id, detalle.lote_id);
    cantidadesDevueltas.set(
      key,
      (cantidadesDevueltas.get(key) || new Decimal('0')).plus(String(detalle.cantidad)),
    );
  }

  const asignaciones = [];
  for (const linea of lineas) {
    const candidatos = detallesOrigen.filter((detalle) =>
      Number(detalle.producto_id) === linea.producto_id
      && (!linea.lote_id || Number(detalle.lote_id) === linea.lote_id));
    let restante = linea.cantidad;
    const lotesProcesados = new Set();
    for (const detalle of candidatos) {
      const key = llave(detalle.producto_id, detalle.lote_id);
      if (lotesProcesados.has(key)) continue;
      lotesProcesados.add(key);
      const vendida = cantidadesVendidas.get(key) || new Decimal('0');
      const devuelta = cantidadesDevueltas.get(key) || new Decimal('0');
      const disponible = Decimal.max(vendida.minus(devuelta), new Decimal('0'));
      const cantidad = Decimal.min(disponible, restante);
      if (cantidad.lte(0)) continue;
      if (!detalle.lote_id) {
        throw new ErrorOperacion(`La venta original no conserva el lote de ${linea.producto.codigo}`);
      }
      const lote = await Lote.findByPk(detalle.lote_id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!lote || Number(lote.producto_id) !== linea.producto_id) {
        throw new ErrorOperacion(`El lote original de ${linea.producto.codigo} ya no está disponible`);
      }
      linea.precio_unitario = preciosVenta.get(linea.producto_id) || linea.precio_unitario;
      asignaciones.push({ linea, lote, cantidad });
      cantidadesDevueltas.set(key, devuelta.plus(cantidad));
      restante = restante.minus(cantidad);
      if (restante.lte(0)) break;
    }
    if (restante.gt(0)) {
      throw new ErrorOperacion(
        `La cantidad devuelta de ${linea.producto.codigo} supera la cantidad vendida disponible`,
      );
    }
  }
  return asignaciones;
}

/**
 * Crea la cabecera, los detalles, los movimientos de kardex (y las filas
 * de ventas compatibles) y el comprobante, todo en una transacción.
 */
async function crearOperacion({
  tipo,
  cliente_id,
  items,
  fecha,
  motivo,
  operacion_origen_id,
  signo,
  idempotency_key,
  usuario_id,
  habilitarStockInicial = false,
  origenVenta = 'manual',
  transaction: transaccionExistente = null,
}) {
  const transaction = transaccionExistente || await Operacion.sequelize.transaction();
  const propiaTransaccion = !transaccionExistente;
  try {
    // Idempotencia: el mismo formulario reenviado devuelve la operación ya creada.
    if (idempotency_key) {
      const existente = await Operacion.findOne({ where: { idempotency_key }, transaction });
      if (existente) {
        const cargada = await obtenerOperacion(existente.id, transaction);
        if (propiaTransaccion) await transaction.rollback();
        return { operacion: cargada, repetida: true };
      }
    }

    const fechaOperacion = fecha ? new Date(fecha) : new Date();
    if (Number.isNaN(fechaOperacion.getTime())) throw new ErrorOperacion('La fecha de la operación es inválida');

    const cliente = cliente_id
      ? validarCliente(await Cliente.findByPk(cliente_id, { transaction }), true)
      : null;

    const cabecera = {
      idempotency_key: idempotency_key || null,
      tipo,
      cliente_id: cliente ? cliente.id : null,
      usuario_id: usuario_id || null,
      fecha: fechaOperacion,
      motivo: motivo ? String(motivo).trim() : null,
    };

    let lineas = [];
    let operacionOrigen = null;
    let asignaciones = [];

    if (tipo === 'ajuste') {
      if (!String(motivo || '').trim()) throw new ErrorOperacion('El ajuste requiere un motivo');
      if (!signo || !['aumenta', 'disminuye'].includes(signo)) {
        throw new ErrorOperacion('Indique si el ajuste aumenta o disminuye el stock');
      }
      const ajusteItems = Array.isArray(items) && items.length === 1 ? items : null;
      if (!ajusteItems) throw new ErrorOperacion('El ajuste se registra para un solo producto');
      lineas = await prepararLineas(ajusteItems, { transaction });
      await Producto.findByPk(lineas[0].producto_id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      const linea = lineas[0];
      if (linea.precio_unitario.gt(0)) linea.precio_unitario = new Decimal('0');
      const lotesAjuste = await asignarLotes(linea, {
        transaction,
        crearLoteParaAjuste: signo === 'aumenta',
        fecha: fechaOperacion,
      });
      for (const asignacion of lotesAjuste) asignacion.linea = linea;
      asignaciones.push(...lotesAjuste);
    } else {
      // venta y devolución
      if (!cliente) throw new ErrorOperacion('Debe seleccionar un cliente');
      if (tipo === 'devolucion') {
        if (!String(motivo || '').trim()) throw new ErrorOperacion('La devolución requiere un motivo');
        if (!operacion_origen_id) throw new ErrorOperacion('Debe vincular la venta original para devolver productos');
        operacionOrigen = await Operacion.findByPk(operacion_origen_id, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (!operacionOrigen || operacionOrigen.tipo !== 'venta' || operacionOrigen.estado !== 'activa') {
          throw new ErrorOperacion('La operación de origen debe ser una venta activa');
        }
        if (Number(operacionOrigen.cliente_id) !== Number(cliente.id)) {
          throw new ErrorOperacion('La venta original pertenece a otro cliente');
        }
        if (new Date(operacionOrigen.fecha) > fechaOperacion) {
          throw new ErrorOperacion('La fecha de devolución no puede ser anterior a la venta');
        }
        lineas = await prepararLineas(items, {
          transaction,
        });
        const idsProducto = [...new Set(lineas.map((linea) => linea.producto_id))].sort((a, b) => a - b);
        await Producto.findAll({
          where: { id: { [Op.in]: idsProducto } },
          order: [['id', 'ASC']],
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        asignaciones = await asignarDevolucion(lineas, operacionOrigen, transaction);
      } else {
        lineas = await prepararLineas(items, { transaction });
        const idsProducto = [...new Set(lineas.map((linea) => linea.producto_id))].sort((a, b) => a - b);
        await Producto.findAll({
          where: { id: { [Op.in]: idsProducto } },
          order: [['id', 'ASC']],
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        for (const linea of lineas) {
          const lotesLinea = await asignarLotes(linea, {
            transaction,
            soloLoteNoVencido: tipo === 'venta',
            habilitarStockInicial: tipo === 'venta' && habilitarStockInicial,
            fecha: fechaOperacion,
            usuario_id,
          });
          for (const asignacion of lotesLinea) asignacion.linea = linea;
          asignaciones.push(...lotesLinea);
        }
      }
    }

    if (tipo === 'ajuste') {
      const idsProducto = [...new Set(lineas.map((linea) => linea.producto_id))].sort((a, b) => a - b);
      await Producto.findAll({
        where: { id: { [Op.in]: idsProducto } },
        order: [['id', 'ASC']],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
    }

    distribuirSubtotales(asignaciones);
    const impuestoPorcentaje = await leerImpuesto(transaction);
    const totales = calcularTotales(lineas, impuestoPorcentaje);

    const operacion = await Operacion.create({
      ...cabecera,
      numero: null,
      operacion_origen_id: operacionOrigen ? operacionOrigen.id : null,
      subtotal: totales.subtotal.toNumber(),
      impuesto_porcentaje: impuestoPorcentaje.toNumber(),
      impuesto: totales.impuesto.toNumber(),
      total: totales.total.toNumber(),
    }, { transaction });

    operacion.numero = numeroDe(PREFIJO_OPERACION[tipo], operacion.id);
    await operacion.save({ fields: ['numero'], transaction });

    // Guardar una fila por asignación para poder devolver y anular al lote correcto.
    for (const asignacion of asignaciones) {
      const { linea, lote, cantidad } = asignacion;
      await OperacionDetalle.create({
        operacion_id: operacion.id,
        producto_id: linea.producto_id,
        lote_id: lote.id,
        cantidad: cantidad.toNumber(),
        precio_unitario: linea.precio_unitario.toNumber(),
        subtotal: asignacion.subtotal.toNumber(),
      }, { transaction });
    }

    // Kardex por lote y filas de ventas compatibles con reportes/KPIs.
    for (const asignacion of asignaciones) {
      const { lote, cantidad } = asignacion;
      const precioLinea = asignacion.linea
        ? asignacion.linea.precio_unitario.toNumber()
        : lineas.find((l) => l.producto_id === lote.producto_id)?.precio_unitario.toNumber() ?? 0;
      if (tipo === 'venta') {
        await registrarMovimiento(
          lote.id, 'salida', cantidad.toNumber(), 'venta',
          `Venta ${operacion.numero}`, null, usuario_id, transaction, fechaOperacion,
        );
        await Venta.create({
          operacion_id: operacion.id,
          producto_id: lote.producto_id,
          lote_id: lote.id,
          cantidad: cantidad.toNumber(),
          precio_unitario: precioLinea,
          fecha_venta: cabecera.fecha,
          origen: origenVenta,
          usuario_id: usuario_id || null,
        }, { transaction });
      } else if (tipo === 'devolucion') {
        await registrarMovimiento(
          lote.id, 'ingreso', cantidad.toNumber(), 'devolucion',
          `Devolución ${operacion.numero}: ${motivo}`, null, usuario_id, transaction, fechaOperacion,
        );
        // Fila negativa para que los reportes neteen la devolución contra la venta.
        await Venta.create({
          operacion_id: operacion.id,
          producto_id: lote.producto_id,
          lote_id: lote.id,
          cantidad: cantidad.negated().toNumber(),
          precio_unitario: precioLinea,
          fecha_venta: cabecera.fecha,
          origen: 'devolucion',
          usuario_id: usuario_id || null,
        }, { transaction });
      } else {
        // ajuste: aumenta -> ingreso, disminuye -> ajuste (salida)
        await registrarMovimiento(
          lote.id,
          signo === 'aumenta' ? 'ingreso' : 'ajuste',
          cantidad.toNumber(),
          'ajuste',
          `Ajuste ${operacion.numero}: ${motivo}`,
          null,
          usuario_id,
          transaction,
          fechaOperacion,
        );
      }
    }

    // Comprobante: solo venta y devolución.
    let comprobante = null;
    if (tipo !== 'ajuste') {
      const tipoComprobante = TIPO_COMPROBANTE[tipo];
      comprobante = await Comprobante.create({
        operacion_id: operacion.id,
        numero: numeroDe(PREFIJO_COMPROBANTE[tipoComprobante], operacion.id),
        tipo: tipoComprobante,
        datos: {},
      }, { transaction });
      operacion.numero_comprobante = comprobante.numero;
      comprobante.datos = construirDatosComprobante({
        operacion,
        cliente,
        usuario: usuario_id ? await require('../models').Usuario.findByPk(usuario_id, { transaction }) : null,
        asignaciones,
        tipoComprobante,
        operacionOrigen,
      });
      await comprobante.save({ fields: ['datos'], transaction });
    }

    await Auditoria.create({
      usuario_id: usuario_id || null,
      accion: 'crear',
      entidad: 'operacion',
      entidad_id: operacion.id,
      detalle: {
        tipo,
        numero: operacion.numero,
        cliente_id: cliente ? cliente.id : null,
        productos: lineas.length,
        total: totales.total.toNumber(),
      },
    }, { transaction });

    if (propiaTransaccion) await transaction.commit();

    const cargada = await obtenerOperacion(operacion.id, propiaTransaccion ? null : transaction);
    return { operacion: cargada, comprobante, repetida: false };
  } catch (error) {
    if (propiaTransaccion) await transaction.rollback();
    if (error instanceof ErrorKardex) throw new ErrorOperacion(error.message);
    throw error;
  }
}

async function obtenerOperacion(id, transaction = null) {
  const operacion = await Operacion.findByPk(id, {
    transaction,
    include: [
      { model: Cliente, as: 'cliente' },
      { model: require('../models').Usuario, as: 'usuario' },
      {
        model: OperacionDetalle,
        as: 'detalles',
        include: [
          { model: Producto, as: 'producto' },
          { model: Lote, as: 'lote' },
        ],
      },
      { model: Comprobante, as: 'comprobante' },
      { model: Operacion, as: 'operacionOrigen' },
    ],
  });
  if (!operacion || operacion.tipo !== 'venta' || !operacion.detalles?.length) return operacion;

  const devoluciones = await Operacion.findAll({
    where: { operacion_origen_id: operacion.id, tipo: 'devolucion', estado: 'activa' },
    attributes: ['id'],
    transaction,
  });
  const idsDevoluciones = devoluciones.map((devolucion) => devolucion.id);
  const detallesDevueltos = idsDevoluciones.length
    ? await OperacionDetalle.findAll({
      where: { operacion_id: { [Op.in]: idsDevoluciones } },
      transaction,
    })
    : [];
  const devueltoPorProducto = new Map();
  for (const detalle of detallesDevueltos) {
    const productoId = Number(detalle.producto_id);
    devueltoPorProducto.set(
      productoId,
      (devueltoPorProducto.get(productoId) || new Decimal('0')).plus(String(detalle.cantidad)),
    );
  }

  const vendidoPorProducto = new Map();
  for (const detalle of operacion.detalles) {
    const productoId = Number(detalle.producto_id);
    vendidoPorProducto.set(
      productoId,
      (vendidoPorProducto.get(productoId) || new Decimal('0')).plus(String(detalle.cantidad)),
    );
  }
  const productosMarcados = new Set();
  for (const detalle of operacion.detalles) {
    const productoId = Number(detalle.producto_id);
    if (productosMarcados.has(productoId)) {
      detalle.setDataValue('cantidad_disponible_devolucion', 0);
      continue;
    }
    productosMarcados.add(productoId);
    const disponible = Decimal.max(
      (vendidoPorProducto.get(productoId) || new Decimal('0'))
        .minus(devueltoPorProducto.get(productoId) || new Decimal('0')),
      new Decimal('0'),
    );
    detalle.setDataValue('cantidad_disponible_devolucion', disponible.toNumber());
  }
  return operacion;
}

async function obtenerComprobanteOperacion(id) {
  const operacion = await obtenerOperacion(id);
  if (!operacion?.comprobante) return { operacion, comprobante: null };

  const ventas = await Venta.findAll({ where: { operacion_id: operacion.id } });
  let ventasReferencia = [];
  let usuario = operacion.usuario || null;
  if (operacion.operacion_origen_id) {
    ventasReferencia = await Venta.findAll({
      where: { operacion_id: operacion.operacion_origen_id },
    });
    if (!usuario && operacion.operacionOrigen?.usuario_id) {
      usuario = await Usuario.findByPk(operacion.operacionOrigen.usuario_id);
    }
  }
  if (!usuario) {
    const usuarioId = ventas.find((venta) => venta.usuario_id)?.usuario_id;
    if (usuarioId) usuario = await Usuario.findByPk(usuarioId);
  }
  const comprobante = operacion.comprobante.toJSON
    ? operacion.comprobante.toJSON()
    : operacion.comprobante;
  let operacionDatos = operacion.toJSON ? operacion.toJSON() : operacion;
  if (!operacionDatos.detalles?.length) {
    const itemsLegado = Array.isArray(comprobante.datos?.items) ? comprobante.datos.items : [];
    const itemsParaReconstruir = itemsLegado.length
      ? itemsLegado
      : ventas.filter((venta) => Number(venta.cantidad) !== 0).map((venta) => ({
        producto_id: venta.producto_id,
        lote_id: venta.lote_id,
        cantidad: Math.abs(Number(venta.cantidad)),
        precio_unitario: venta.precio_unitario,
        subtotal: Math.abs(Number(venta.cantidad) * Number(venta.precio_unitario)),
      }));
    const productoIds = [...new Set(itemsParaReconstruir
      .map((item) => Number(item.producto_id))
      .filter(Number.isInteger))];
    const productos = productoIds.length
      ? await Producto.findAll({ where: { id: { [Op.in]: productoIds } } })
      : [];
    const productosPorId = new Map(productos.map((producto) => [Number(producto.id), producto]));
    operacionDatos = {
      ...operacionDatos,
      detalles: itemsParaReconstruir.map((item) => ({
        ...item,
        producto_id: Number(item.producto_id),
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
        subtotal: item.subtotal,
        lote_id: item.lote_id ?? null,
        producto: productosPorId.get(Number(item.producto_id)) || {
          id: item.producto_id,
          codigo: item.codigo,
          nombre: item.producto,
        },
      })),
    };
  }
  return {
    operacion: operacionDatos,
    comprobante: {
      ...comprobante,
      datos: reconstruirDatosComprobante(
        operacionDatos,
        comprobante,
        [...ventas, ...ventasReferencia],
        usuario,
      ),
    },
  };
}

async function listarOperaciones({ tipo, cliente_id, fecha_desde, fecha_hasta, buscar } = {}) {
  const where = {};
  if (tipo) where.tipo = tipo;
  if (cliente_id) where.cliente_id = cliente_id;
  if (fecha_desde || fecha_hasta) {
    where.fecha = {};
    if (fecha_desde) where.fecha[Op.gte] = fecha_desde;
    if (fecha_hasta) where.fecha[Op.lte] = fecha_hasta;
  }
  if (buscar) where.numero = { [Op.iLike]: `%${buscar}%` };
  return Operacion.findAll({
    where,
    include: [
      { model: Cliente, as: 'cliente' },
      { model: require('../models').Usuario, as: 'usuario' },
      { model: Comprobante, as: 'comprobante' },
    ],
    order: [['fecha', 'DESC'], ['id', 'DESC']],
  });
}

async function anularOperacion(id, usuario_id) {
  const transaction = await Operacion.sequelize.transaction();
  try {
    const operacion = await Operacion.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!operacion) throw new ErrorOperacion('Operación no encontrada');
    if (operacion.estado === 'anulada') throw new ErrorOperacion('La operación ya está anulada');
    if (operacion.tipo !== 'venta') throw new ErrorOperacion('Solo se pueden anular ventas');
    if (!puedeAnularOperacion(operacion)) {
      throw new ErrorOperacion('Solo se puede anular una venta durante las primeras 48 horas desde su creación');
    }
    const devolucionActiva = await Operacion.findOne({
      where: { operacion_origen_id: id, tipo: 'devolucion', estado: 'activa' },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (devolucionActiva) {
      throw new ErrorOperacion('No se puede anular una venta que ya tiene devoluciones activas');
    }

    // Revertir el inventario: cada salida de la venta vuelve como devolución.
    const detalles = await OperacionDetalle.findAll({ where: { operacion_id: id }, transaction });
    for (const detalle of detalles) {
      if (!detalle.lote_id) {
        throw new ErrorOperacion('La venta contiene detalles sin lote y no se puede revertir con seguridad');
      }
      await registrarMovimiento(
        detalle.lote_id, 'ingreso', Number(detalle.cantidad), 'anulacion',
        `Anulación ${operacion.numero}`, null, usuario_id, transaction, new Date(),
      );
    }

    const ventasOriginales = await Venta.findAll({
      where: { operacion_id: operacion.id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    for (const venta of ventasOriginales) {
      await Venta.create({
        operacion_id: operacion.id,
        producto_id: venta.producto_id,
        lote_id: venta.lote_id,
        cantidad: new Decimal(String(venta.cantidad)).negated().toNumber(),
        precio_unitario: venta.precio_unitario,
        fecha_venta: new Date(),
        origen: 'anulacion',
        usuario_id: usuario_id || null,
      }, { transaction });
    }

    operacion.estado = 'anulada';
    await operacion.save({ fields: ['estado'], transaction });

    await Auditoria.create({
      usuario_id: usuario_id || null,
      accion: 'anular',
      entidad: 'operacion',
      entidad_id: operacion.id,
      detalle: { tipo: operacion.tipo, numero: operacion.numero },
    }, { transaction });

    await transaction.commit();
    return obtenerOperacion(id);
  } catch (error) {
    await transaction.rollback();
    if (error instanceof ErrorKardex) throw new ErrorOperacion(error.message);
    throw error;
  }
}

async function buscarVentaOrigenDevolucion({ cliente_id, producto_id, cantidad, fecha, transaction }) {
  const ventas = await Operacion.findAll({
    where: {
      tipo: 'venta',
      estado: 'activa',
      cliente_id,
      fecha: { [Op.lte]: fecha },
    },
    order: [['fecha', 'DESC'], ['id', 'DESC']],
    transaction,
    lock: transaction ? transaction.LOCK.UPDATE : undefined,
  });
  const fechaLimite = new Date(fecha);
  const idsVentas = ventas.map((venta) => venta.id);
  const devoluciones = idsVentas.length
    ? await Operacion.findAll({
      where: {
        operacion_origen_id: { [Op.in]: idsVentas },
        tipo: 'devolucion',
        estado: 'activa',
        fecha: { [Op.lte]: fechaLimite },
      },
      attributes: ['id', 'operacion_origen_id'],
      transaction,
    })
    : [];
  const idsDevoluciones = devoluciones.map((devolucion) => devolucion.id);
  const detallesDevoluciones = idsDevoluciones.length
    ? await OperacionDetalle.findAll({
      where: {
        operacion_id: { [Op.in]: idsDevoluciones },
        producto_id,
      },
      transaction,
    })
    : [];
  const devueltoPorOperacion = new Map();
  for (const detalle of detallesDevoluciones) {
    const devolucion = devoluciones.find((fila) => Number(fila.id) === Number(detalle.operacion_id));
    if (!devolucion) continue;
    const previo = devueltoPorOperacion.get(Number(devolucion.operacion_origen_id)) || new Decimal('0');
    devueltoPorOperacion.set(
      Number(devolucion.operacion_origen_id),
      previo.plus(String(detalle.cantidad)),
    );
  }

  const cantidadRequerida = decimalDe(cantidad);
  for (const venta of ventas) {
    const detalles = await OperacionDetalle.findAll({
      where: { operacion_id: venta.id, producto_id },
      transaction,
    });
    const vendida = detalles.reduce(
      (total, detalle) => total.plus(String(detalle.cantidad)),
      new Decimal('0'),
    );
    const disponible = vendida.minus(devueltoPorOperacion.get(Number(venta.id)) || 0);
    if (disponible.gte(cantidadRequerida)) return venta;
  }
  throw new ErrorOperacion('No se encontró una venta activa con cantidad disponible para esta devolución');
}

async function leerConfiguracionImpuesto() {
  const impuesto = await leerImpuesto(null);
  return { impuesto_porcentaje: impuesto.toNumber() };
}

async function guardarConfiguracionImpuesto(valor, usuario_id) {
  const porcentaje = decimalDe(valor);
  if (!porcentaje.isFinite() || porcentaje.lt(0) || porcentaje.gt(100)) {
    throw new ErrorOperacion('El porcentaje de impuesto debe estar entre 0 y 100');
  }
  const redondeado = porcentaje.toDecimalPlaces(2, DOS_LUGARES);
  const [fila, creada] = await Configuracion.findOrCreate({
    where: { clave: 'impuesto_porcentaje' },
    defaults: { clave: 'impuesto_porcentaje', valor: redondeado.toString() },
  });
  if (!creada) {
    fila.valor = redondeado.toString();
    await fila.save();
  }
  await Auditoria.create({
    usuario_id: usuario_id || null,
    accion: 'configurar',
    entidad: 'configuracion',
    entidad_id: fila.id,
    detalle: { clave: 'impuesto_porcentaje', valor: redondeado.toString() },
  });
  return { impuesto_porcentaje: redondeado.toNumber() };
}

module.exports = {
  ErrorOperacion,
  crearOperacion,
  obtenerOperacion,
  obtenerComprobanteOperacion,
  reconstruirDatosComprobante,
  listarOperaciones,
  anularOperacion,
  puedeAnularOperacion,
  buscarVentaOrigenDevolucion,
  leerConfiguracionImpuesto,
  guardarConfiguracionImpuesto,
};
