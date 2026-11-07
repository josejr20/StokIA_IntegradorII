const { Op, fn, col } = require('sequelize');
const { Producto, Lote, Venta } = require('../models');
const { evaluarProducto, PERIODO_VENTAS_DIAS } = require('./recomendacionMotor');

function fechaLima(fecha = new Date()) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(fecha);
  const mapa = Object.fromEntries(partes.filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
  return `${mapa.year}-${mapa.month}-${mapa.day}`;
}

async function listarRecomendaciones() {
  // Solamente lecturas: no cambia ventas, inventario ni tablas existentes.
  const productos = await Producto.findAll({
    where: { activo: true },
    attributes: ['id', 'codigo', 'nombre'],
    include: [{ model: Lote, as: 'lotes', attributes: ['cantidad_actual', 'fecha_vencimiento'] }],
    order: [['id', 'ASC']]
  });

  const ids = productos.map(p => p.id);
  if (ids.length === 0) return { generado_en: new Date().toISOString(), periodo_dias: PERIODO_VENTAS_DIAS, data: [] };

  const hoy = new Date();
  const inicio = new Date(hoy);
  inicio.setUTCDate(inicio.getUTCDate() - (PERIODO_VENTAS_DIAS - 1));
  const fechaInicio = `${fechaLima(inicio)}T00:00:00-05:00`;
  const fechaFinal = `${fechaLima(hoy)}T23:59:59-05:00`;

  // Las devoluciones y anulaciones ya están guardadas como ventas NEGATIVAS.
  // Al sumarlas obtenemos ventas netas sin duplicar las operaciones.
  const ventas = await Venta.findAll({
    attributes: [
      'producto_id',
      [fn('SUM', col('cantidad')), 'neto'],
      [fn('COUNT', col('id')), 'registros']
    ],
    where: {
      producto_id: { [Op.in]: ids },
      fecha_venta: { [Op.between]: [new Date(fechaInicio), new Date(fechaFinal)] }
    },
    group: ['producto_id'],
    raw: true
  });
  const ventasPorProducto = new Map(ventas.map(v => [Number(v.producto_id), v]));

  const resultados = productos.map(modelo => {
    const producto = modelo.get({ plain: true });
    const venta = ventasPorProducto.get(Number(producto.id));
    return evaluarProducto({
      ...producto,
      ventas_netas_30d: venta?.neto ?? 0,
      registros_ventas_30d: venta?.registros ?? 0
    }, { hoy });
  });
  const ordenPrioridad = { alta: 0, media: 1, baja: 2 };
  resultados.sort((a, b) => ordenPrioridad[a.prioridad] - ordenPrioridad[b.prioridad] || a.nombre.localeCompare(b.nombre));

  return { generado_en: hoy.toISOString(), periodo_dias: PERIODO_VENTAS_DIAS, data: resultados };
}

module.exports = { listarRecomendaciones };
