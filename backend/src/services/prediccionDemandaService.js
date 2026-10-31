'use strict';

/**
 * HU-72 · BE-01 — Servicio de predicción de demanda.
 * Lee el historial de ventas (tabla `ventas`), aplica el modelo y arma la respuesta.
 * Solo cuentan las ventas netas (manual + importado), igual que /api/ventas/resumen.
 */

const modelo = require('./prediccionDemandaModelo');

const ORIGENES_VENTA = ['manual', 'importado'];

// Acceso a datos separado para poder reemplazarlo en las pruebas.
// Los modelos se cargan solo al usarse, para que este archivo no abra la base al importarlo.
function repositorioPorDefecto() {
  const { Venta, Producto } = require('../models');
  const { Op } = require('sequelize');
  return {
    productos: (ids) => Producto.findAll({
      where: { id: { [Op.in]: ids } },
      attributes: ['id', 'codigo', 'nombre', 'activo'],
      raw: true,
    }),
    ventas: (ids, desde, hastaExclusivo) => Venta.findAll({
      where: {
        producto_id: { [Op.in]: ids },
        origen: { [Op.in]: ORIGENES_VENTA },
        fecha_venta: { [Op.gte]: desde, [Op.lt]: hastaExclusivo },
      },
      attributes: ['producto_id', 'cantidad', 'fecha_venta'],
      raw: true,
    }),
  };
}

/**
 * Predice la demanda de varios productos con UNA sola consulta de ventas.
 * Devuelve un resultado por cada id pedido, en el mismo orden.
 */
async function predecirProductos(productoIds, {
  horizonte = modelo.CONFIG.HORIZONTE_DEFECTO,
  ahora = new Date(),
  repositorio,
} = {}) {
  const repo = repositorio ?? repositorioPorDefecto();
  const hasta = modelo.ultimoDiaCompleto(ahora);
  const rango = modelo.rangoConsultaUtc(hasta);

  const [productos, ventas] = await Promise.all([
    repo.productos(productoIds),
    repo.ventas(productoIds, rango.desde, rango.hasta),
  ]);

  const productoPorId = new Map(productos.map((producto) => [Number(producto.id), producto]));
  const ventasPorProducto = new Map();
  for (const venta of ventas) {
    const id = Number(venta.producto_id);
    if (!ventasPorProducto.has(id)) ventasPorProducto.set(id, []);
    ventasPorProducto.get(id).push(venta);
  }

  const resultados = productoIds.map((id) => {
    const producto = productoPorId.get(id);
    if (!producto) {
      return {
        producto_id: id,
        producto: null,
        estado: 'no_encontrado',
        horizonte_dias: horizonte,
        mensaje: 'El producto seleccionado no existe.',
      };
    }
    return {
      producto_id: id,
      producto: {
        id: Number(producto.id),
        codigo: producto.codigo,
        nombre: producto.nombre,
        activo: producto.activo,
      },
      ...modelo.predecirDemanda(ventasPorProducto.get(id) ?? [], { horizonte, hasta }),
    };
  });

  return {
    generado_en: ahora.toISOString(),
    horizonte_dias: horizonte,
    ultimo_dia_analizado: hasta,
    resultados,
  };
}

/** Un solo producto (lo usa ml_client.obtenerPrediccion). */
async function predecirProducto(productoId, horizonteDias, opciones = {}) {
  const horizonte = modelo.normalizarHorizonte(horizonteDias);
  const respuesta = await predecirProductos([Number(productoId)], { ...opciones, horizonte });
  return respuesta.resultados[0];
}

module.exports = { predecirProductos, predecirProducto, ORIGENES_VENTA };
