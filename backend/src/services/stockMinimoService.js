'use strict';

const { Op, fn, col } = require('sequelize');
const { Producto, Lote, UmbralConfiguracion, Alerta } = require('../models');
const logger = require('../utils/logger');
const {
  ErrorStockMinimo,
  validarStockMinimo,
  minimoPredeterminado,
  evaluarStock
} = require('./reglasStockMinimo');

function leerIdProducto(valor) {
  const numero = Number(valor);
  if (!Number.isSafeInteger(numero) || numero <= 0) {
    throw new ErrorStockMinimo('Seleccione un producto valido.');
  }
  return numero;
}

function esMinimoValido(valor) {
  try { return validarStockMinimo(valor); } catch { return null; }
}

async function obtenerResumenStockMinimo(productoId = null) {
  const id = productoId === null ? null : leerIdProducto(productoId);
  const whereProductos = { activo: true };
  if (id !== null) whereProductos.id = id;

  const productos = await Producto.findAll({
    where: whereProductos,
    attributes: ['id', 'codigo', 'nombre'],
    order: [['nombre', 'ASC'], ['id', 'ASC']]
  });
  if (id !== null && productos.length === 0) {
    throw new ErrorStockMinimo('Producto no encontrado o inactivo.', 404);
  }

  // Stock vendible: no cuenta lotes agotados ni vencidos.
  const partes = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const fecha = Object.fromEntries(partes.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
  const hoy = `${fecha.year}-${fecha.month}-${fecha.day}`;
  const dondeLotes = {
    cantidad_actual: { [Op.gt]: 0 },
    [Op.or]: [
      { fecha_vencimiento: null },
      { fecha_vencimiento: { [Op.gte]: hoy } }
    ]
  };
  if (id !== null) dondeLotes.producto_id = id;
  const [lotes, configuraciones] = await Promise.all([
    Lote.findAll({
      attributes: ['producto_id', [fn('SUM', col('cantidad_actual')), 'stock_disponible']],
      where: dondeLotes,
      group: ['producto_id'],
      raw: true
    }),
    UmbralConfiguracion.findAll({ where: { tipo: 'stock_minimo' }, order: [['fecha_actualizacion', 'DESC'], ['id', 'DESC']] })
  ]);

  const stockPorProducto = new Map(lotes.map((lote) => [Number(lote.producto_id), Number(lote.stock_disponible)]));
  const configuracionesPorProducto = new Map();
  let global = null;
  for (const registro of configuraciones) {
    const valor = esMinimoValido(registro.valor);
    if (valor === null) continue;
    if (registro.producto_id === null || registro.producto_id === undefined) {
      if (global === null) global = valor;
    } else if (!configuracionesPorProducto.has(Number(registro.producto_id))) {
      configuracionesPorProducto.set(Number(registro.producto_id), { id: registro.id, valor });
    }
  }
  const predeterminado = global ?? minimoPredeterminado();
  const origenDefault = global !== null ? 'global' : 'predeterminado';

  const data = productos.map((producto) => {
    const configurado = configuracionesPorProducto.get(producto.id);
    const umbral = configurado?.valor ?? predeterminado;
    const resultado = evaluarStock(stockPorProducto.get(producto.id) ?? 0, umbral);
    return {
      producto_id: producto.id,
      codigo: producto.codigo,
      nombre: producto.nombre,
      ...resultado,
      configurado: Boolean(configurado),
      configuracion_id: configurado?.id ?? null,
      origen_umbral: configurado ? 'producto' : origenDefault,
      aviso: configurado ? null : 'Se esta usando el valor por defecto.'
    };
  });
  return {
    data,
    minimo_predeterminado: predeterminado,
    total: data.length,
    bajo_stock: data.filter((producto) => producto.bajo_stock).length
  };
}

async function guardarStockMinimo(productoId, valor) {
  const id = leerIdProducto(productoId);
  const minimo = validarStockMinimo(valor);
  const producto = await Producto.findByPk(id);
  if (!producto || !producto.activo) {
    throw new ErrorStockMinimo('Producto no encontrado o inactivo.', 404);
  }
  let registro = await UmbralConfiguracion.findOne({ where: { tipo: 'stock_minimo', producto_id: id } });
  if (registro) {
    await registro.update({ valor: minimo, fecha_actualizacion: new Date() });
  } else {
    try {
      registro = await UmbralConfiguracion.create({
        tipo: 'stock_minimo', producto_id: id, valor: minimo, fecha_actualizacion: new Date()
      });
    } catch (error) {
      // Otro usuario pudo crear el mismo registro unos milisegundos antes.
      if (error.name !== 'SequelizeUniqueConstraintError') throw error;
      registro = await UmbralConfiguracion.findOne({ where: { tipo: 'stock_minimo', producto_id: id } });
      if (!registro) throw error;
      await registro.update({ valor: minimo, fecha_actualizacion: new Date() });
    }
  }
  return registro;
}

async function restablecerStockMinimo(productoId) {
  const id = leerIdProducto(productoId);
  const eliminados = await UmbralConfiguracion.destroy({ where: { tipo: 'stock_minimo', producto_id: id } });
  if (!eliminados) throw new ErrorStockMinimo('El producto ya usaba el minimo por defecto.', 404);
  return eliminados;
}

async function evaluarAlertasStockMinimo(productoId = null) {
  const resumen = await obtenerResumenStockMinimo(productoId);
  let creadas = 0;
  let actualizadas = 0;
  let resueltas = 0;
  for (const producto of resumen.data) {
    const alertas = await Alerta.findAll({
      where: {
        tipo: 'bajo_stock',
        producto_id: producto.producto_id,
        estado: { [Op.in]: ['nueva', 'vista'] }
      },
      order: [['fecha_creacion', 'DESC']]
    });
    const alerta = alertas.find((a) => a.datos_origen?.origen === 'stock_minimo');
    if (producto.bajo_stock) {
      const mensaje = `Stock bajo de ${producto.nombre}: quedan ${producto.stock_disponible} unidades; minimo ${producto.stock_minimo}.` +
        (producto.configurado ? '' : ' Se aplico el minimo por defecto.');
      const severidad = producto.stock_disponible === 0 ? 'alta' : 'media';
      const datos_origen = {
        origen: 'stock_minimo',
        stock_disponible: producto.stock_disponible,
        stock_minimo: producto.stock_minimo,
        origen_umbral: producto.origen_umbral,
        configuracion_por_defecto: !producto.configurado
      };
      if (alerta) {
        await alerta.update({ mensaje, severidad, datos_origen });
        actualizadas++;
      } else {
        await Alerta.create({
          tipo: 'bajo_stock', producto_id: producto.producto_id, mensaje,
          severidad, datos_origen, estado: 'nueva'
        });
        creadas++;
      }
    } else if (alerta) {
      await alerta.update({ estado: 'atendida', fecha_atendida: new Date() });
      resueltas++;
    }
  }
  logger.info(`Evaluacion de stock minimo: ${creadas} nuevas, ${actualizadas} actualizadas, ${resueltas} resueltas`);
  return { creadas, actualizadas, resueltas, productos_evaluados: resumen.data.length, sin_configuracion: resumen.data.filter((p) => !p.configurado).length };
}

module.exports = {
  leerIdProducto,
  obtenerResumenStockMinimo,
  guardarStockMinimo,
  restablecerStockMinimo,
  evaluarAlertasStockMinimo
};
