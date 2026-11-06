const { Op } = require('sequelize');
const { Operacion, OperacionDetalle, Cliente, Producto, Comprobante, Usuario } = require('../models');
const { Decimal } = require('decimal.js');

const DOS_LUGARES = Decimal.ROUND_HALF_UP;
const MS_DIA = 24 * 60 * 60 * 1000;
const ZONA_HORARIA_LIMA = 'America/Lima';

function obtenerFechaLima(valor) {
  const fecha = valor instanceof Date ? valor : new Date(valor);
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA_HORARIA_LIMA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(fecha);
  const componentes = Object.fromEntries(partes.map(({ type, value }) => [type, value]));
  return `${componentes.year}-${componentes.month}-${componentes.day}`;
}

function obtenerRangoFechaLima(fecha) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    throw new Error('La fecha debe tener el formato YYYY-MM-DD');
  }
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const inicio = new Date(Date.UTC(anio, mes - 1, dia, 5));
  if (obtenerFechaLima(inicio) !== fecha) {
    throw new Error('La fecha indicada no es válida');
  }
  return { [Op.gte]: inicio, [Op.lt]: new Date(inicio.getTime() + MS_DIA) };
}

function normalizarNombreCliente(nombre) {
  if (!nombre) return 'sin_cliente';
  return String(nombre)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function obtenerClaveCliente(op) {
  const cliente = op.cliente || {};
  const nombre = cliente.nombre || op.cliente_nombre || '';
  const doc = cliente.documento || op.cliente_documento || '';
  if (doc && String(doc).trim()) return `doc:${String(doc).trim().toLowerCase()}`;
  const norm = normalizarNombreCliente(nombre);
  if (norm && norm !== 'sin_cliente') return `nom:${norm}`;
  if (op.cliente_id) return `id:${op.cliente_id}`;
  return 'sn';
}

function agruparDetalle(lineas) {
  const mapa = new Map();
  for (const linea of lineas) {
    const key = `${linea.producto_id}:${Number(linea.precio_unitario).toFixed(2)}`;
    if (!mapa.has(key)) {
      mapa.set(key, {
        producto_id: linea.producto_id,
        producto_codigo: linea.producto_codigo,
        producto_nombre: linea.producto_nombre,
        precio_unitario: new Decimal(linea.precio_unitario),
        cantidad: new Decimal('0'),
        subtotal: new Decimal('0'),
      });
    }
    const item = mapa.get(key);
    item.cantidad = item.cantidad.plus(new Decimal(linea.cantidad));
    item.subtotal = item.subtotal.plus(new Decimal(linea.subtotal));
  }
  return Array.from(mapa.values()).map((item) => ({
    producto_id: item.producto_id,
    codigo: item.producto_codigo,
    producto: item.producto_nombre,
    cantidad: Number(item.cantidad.toDecimalPlaces(3)),
    precio_unitario: Number(item.precio_unitario.toDecimalPlaces(2)),
    subtotal: Number(item.subtotal.toDecimalPlaces(2)),
  }));
}

async function listarComprobantesAgrupados({ fecha, cliente_id } = {}) {
  const where = { tipo: 'venta', estado: 'activa' };
  if (cliente_id) where.cliente_id = cliente_id;
  const fechaConsulta = fecha || obtenerFechaLima(new Date());
  where.fecha = obtenerRangoFechaLima(fechaConsulta);

  const operaciones = await Operacion.findAll({
    where,
    include: [
      { model: Cliente, as: 'cliente' },
      { model: Usuario, as: 'usuario' },
      {
        model: OperacionDetalle,
        as: 'detalles',
        include: [{ model: Producto, as: 'producto', attributes: ['id', 'codigo', 'nombre'] }],
      },
      { model: Comprobante, as: 'comprobante' },
    ],
    order: [['fecha', 'ASC'], ['id', 'ASC']],
  });

  const grupos = new Map();
  for (const op of operaciones) {
    const fechaOp = obtenerFechaLima(op.fecha);
    const claveCliente = obtenerClaveCliente(op);
    const key = `${claveCliente}|${fechaOp}`;
    if (!grupos.has(key)) {
      grupos.set(key, {
        id: key,
        claveCliente,
        cliente_id: op.cliente_id,
        cliente: op.cliente,
        fecha: fechaOp,
        operaciones: [],
        lineas: [],
        subtotal: new Decimal('0'),
        impuesto: new Decimal('0'),
        total: new Decimal('0'),
        usuario: op.usuario,
      });
    }
    const grupo = grupos.get(key);
    grupo.operaciones.push(op);
    if (!grupo.cliente && op.cliente) grupo.cliente = op.cliente;
    if (!grupo.usuario && op.usuario) grupo.usuario = op.usuario;
    for (const det of op.detalles || []) {
      grupo.lineas.push({
        producto_id: det.producto_id,
        producto_codigo: det.producto?.codigo || det.producto_codigo || '',
        producto_nombre: det.producto?.nombre || det.producto_nombre || '',
        cantidad: det.cantidad,
        precio_unitario: det.precio_unitario,
        subtotal: det.subtotal,
      });
    }
    grupo.subtotal = grupo.subtotal.plus(new Decimal(op.subtotal || '0'));
    grupo.impuesto = grupo.impuesto.plus(new Decimal(op.impuesto || '0'));
    grupo.total = grupo.total.plus(new Decimal(op.total || '0'));
  }

  const resultado = [];
  for (const grupo of grupos.values()) {
    const clienteNombre = grupo.cliente?.nombre || '';
    resultado.push({
      id: grupo.id,
      cliente_id: grupo.cliente_id,
      cliente: grupo.cliente ? { id: grupo.cliente.id, nombre: grupo.cliente.nombre, documento: grupo.cliente.documento || null } : (clienteNombre ? { id: 0, nombre: clienteNombre, documento: null } : null),
      fecha: grupo.fecha,
      operaciones_count: grupo.operaciones.length,
      numeros_operacion: grupo.operaciones.map((o) => o.numero).filter(Boolean).sort(),
      items: agruparDetalle(grupo.lineas),
      subtotal: Number(grupo.subtotal.toDecimalPlaces(2)),
      impuesto: Number(grupo.impuesto.toDecimalPlaces(2)),
      total: Number(grupo.total.toDecimalPlaces(2)),
      vendedor: grupo.usuario ? { nombres: grupo.usuario.nombres, apellidos: grupo.usuario.apellidos } : null,
    });
  }
  return resultado.sort((a, b) => (a.cliente?.nombre || '').localeCompare(b.cliente?.nombre || ''));
}

async function obtenerComprobanteAgrupado(id) {
  const [claveCliente, fecha] = String(id).split('|');
  if (!fecha) return null;

  const whereFecha = obtenerRangoFechaLima(fecha);

  const allOps = await Operacion.findAll({
    where: { tipo: 'venta', estado: 'activa', fecha: whereFecha },
    include: [
      { model: Cliente, as: 'cliente' },
      { model: Usuario, as: 'usuario' },
      {
        model: OperacionDetalle,
        as: 'detalles',
        include: [{ model: Producto, as: 'producto', attributes: ['id', 'codigo', 'nombre'] }],
      },
    ],
    order: [['fecha', 'ASC'], ['id', 'ASC']],
  });

  const operaciones = allOps.filter((op) => obtenerClaveCliente(op) === claveCliente);
  if (!operaciones.length) return null;

  const lineas = [];
  let subtotal = new Decimal('0');
  let impuesto = new Decimal('0');
  let total = new Decimal('0');
  const numeros = [];

  for (const op of operaciones) {
    numeros.push(op.numero);
    subtotal = subtotal.plus(new Decimal(op.subtotal || '0'));
    impuesto = impuesto.plus(new Decimal(op.impuesto || '0'));
    total = total.plus(new Decimal(op.total || '0'));
    for (const det of op.detalles || []) {
      lineas.push({
        producto_id: det.producto_id,
        producto_codigo: det.producto?.codigo || det.producto_codigo || '',
        producto_nombre: det.producto?.nombre || det.producto_nombre || '',
        cantidad: det.cantidad,
        precio_unitario: det.precio_unitario,
        subtotal: det.subtotal,
      });
    }
  }

  const cliente = operaciones.find((op) => op.cliente)?.cliente || operaciones[0].cliente;
  const usuario = operaciones.find((op) => op.usuario)?.usuario || operaciones[0].usuario;
  const clienteNombre = cliente?.nombre || operaciones.map((o) => o.cliente?.nombre).find(Boolean) || '';

  return {
    id,
    numero_operacion: `${numeros.filter(Boolean).length} operaciones`,
    numero_comprobante: `CG-${claveCliente.replace(/[^a-z0-9]+/g, '-')}-${fecha.replace(/-/g, '')}`,
    tipo_comprobante: 'boleta',
    fecha: operaciones[0].fecha,
    cliente: cliente ? { id: cliente.id, nombre: cliente.nombre, documento: cliente.documento || null } : (clienteNombre ? { id: 0, nombre: clienteNombre, documento: null } : null),
    vendedor: usuario ? { id: usuario.id, nombres: usuario.nombres, apellidos: usuario.apellidos, email: usuario.email } : null,
    items: agruparDetalle(lineas),
    subtotal: Number(subtotal.toDecimalPlaces(2)),
    impuesto_porcentaje: operaciones[0].impuesto_porcentaje ? Number(operaciones[0].impuesto_porcentaje) : 0,
    impuesto: Number(impuesto.toDecimalPlaces(2)),
    total: Number(total.toDecimalPlaces(2)),
    motivo: `Agrupado de operaciones: ${numeros.filter(Boolean).sort().join(', ')}`,
    operacion_origen: null,
    operaciones: numeros.filter(Boolean).sort(),
  };
}

module.exports = { listarComprobantesAgrupados, obtenerComprobanteAgrupado };
