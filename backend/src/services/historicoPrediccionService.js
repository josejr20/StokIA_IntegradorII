'use strict';

/**
 * HU-128 (US-25) · BE-01 — Servicio del histórico de predicciones vs ventas reales.
 * Lee las ventas netas (manual + importado, igual que HU-72) y arma la comparación por producto y periodo.
 * El acceso a datos está separado (`repositorio`) para poder probar sin base de datos.
 */

const demanda = require('./prediccionDemandaModelo');
const historico = require('./historicoPrediccionModelo');
const { ORIGENES_VENTA } = require('./prediccionDemandaService');
const logger = require('../utils/logger');

// Los modelos se cargan solo al usarse, para que este archivo no abra la base al importarlo.
function repositorioPorDefecto() {
  const { Venta, Producto } = require('../models');
  const { Op } = require('sequelize');
  return {
    producto: (id) => Producto.findByPk(id, { attributes: ['id', 'codigo', 'nombre', 'activo'], raw: true }),
    productos: (ids) => Producto.findAll({
      where: { id: { [Op.in]: ids } },
      attributes: ['id', 'codigo', 'nombre', 'activo'],
      raw: true,
    }),
    // productoId = null -> ventas de todos los productos.
    ventas: (productoId, desde, hastaExclusivo) => Venta.findAll({
      where: {
        ...(productoId === null ? {} : { producto_id: productoId }),
        origen: { [Op.in]: ORIGENES_VENTA },
        fecha_venta: { [Op.gte]: desde, [Op.lt]: hastaExclusivo },
      },
      attributes: ['producto_id', 'cantidad', 'fecha_venta'],
      raw: true,
    }),
    // Parámetros del modelo activo (si no hay o falla la consulta, se usan los de defecto).
    modeloActivo: async () => {
      try {
        return await require('./mlModeloRepositorio').obtenerModeloActivo();
      } catch (error) {
        logger.warn(`No se pudo cargar el modelo activo para la comparación histórica: ${error.message}`);
        return null;
      }
    },
  };
}

/**
 * Compara predicción y venta real.
 * `consulta` = { productoId, desde, hasta, periodoDias, hastaAjustado } (ya validada con validarFiltros).
 */
async function compararPrediccionVsVentas(consulta, { repositorio, ahora = new Date() } = {}) {
  const repo = repositorio ?? repositorioPorDefecto();
  const { productoId, desde, hasta, periodoDias, hastaAjustado } = consulta;
  const periodos = historico.construirPeriodos(desde, hasta, periodoDias);
  const rango = historico.rangoConsulta(desde, hasta);

  let productoUnico = null;
  if (productoId !== null) {
    productoUnico = await repo.producto(productoId);
    if (!productoUnico) throw new historico.ErrorHistorico('El producto seleccionado no existe.', 404);
  }

  const [ventas, modeloActivo] = await Promise.all([
    repo.ventas(productoId, rango.desde, rango.hasta),
    repo.modeloActivo ? repo.modeloActivo() : null,
  ]);
  const parametros = modeloActivo?.parametros;
  const versionModelo = typeof modeloActivo?.version === 'number' ? `v${modeloActivo.version}` : modeloActivo?.version;

  const ventasPorProducto = new Map();
  for (const venta of ventas) {
    const id = Number(venta.producto_id);
    if (!ventasPorProducto.has(id)) ventasPorProducto.set(id, []);
    ventasPorProducto.get(id).push(venta);
  }

  // Sin filtro: solo los productos con ventas dentro del rango (los demás no tienen nada que comparar),
  // ordenados por unidades vendidas y limitados para que la respuesta siga siendo manejable.
  let ids;
  let truncado = false;
  if (productoId !== null) {
    ids = [productoId];
  } else {
    const inicioMs = Date.parse(`${desde}T00:00:00-05:00`);
    const finMs = Date.parse(`${hasta}T00:00:00-05:00`) + 24 * 60 * 60 * 1000;
    const unidades = new Map();
    for (const [id, filas] of ventasPorProducto) {
      const enRango = filas.filter((fila) => {
        const ms = new Date(fila.fecha_venta).getTime();
        return ms >= inicioMs && ms < finMs;
      });
      if (enRango.length > 0) unidades.set(id, enRango.reduce((suma, fila) => suma + Number(fila.cantidad), 0));
    }
    const ordenados = [...unidades.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).map(([id]) => id);
    truncado = ordenados.length > historico.CONFIG.MAX_PRODUCTOS_SIN_FILTRO;
    ids = ordenados.slice(0, historico.CONFIG.MAX_PRODUCTOS_SIN_FILTRO);
  }

  const productos = productoUnico ? [productoUnico] : (ids.length ? await repo.productos(ids) : []);
  const productoPorId = new Map(productos.map((p) => [Number(p.id), p]));

  const detalle = [];
  for (const id of ids) {
    const producto = productoPorId.get(id);
    if (!producto) continue;
    const ventasProducto = ventasPorProducto.get(id) ?? [];
    for (const periodo of periodos) {
      detalle.push({
        producto_id: id,
        producto_codigo: producto.codigo,
        producto_nombre: producto.nombre,
        ...historico.compararPeriodo(ventasProducto, periodo, { periodoDias, parametros, versionModelo }),
      });
    }
  }
  detalle.sort((a, b) => a.periodo_inicio.localeCompare(b.periodo_inicio)
    || String(a.producto_nombre).localeCompare(String(b.producto_nombre), 'es'));

  const totales = historico.agregarPorPeriodo(periodos, detalle);
  const resumen = historico.resumir(detalle);
  const hayDatos = resumen.comparaciones > 0;

  return {
    generado_en: ahora.toISOString(),
    filtros: {
      producto_id: productoId, desde, hasta, periodo_dias: periodoDias, hasta_ajustado: hastaAjustado,
    },
    hay_datos: hayDatos,
    mensaje: hayDatos ? null : 'No hay datos suficientes para comparar en el rango seleccionado.',
    productos_truncados: truncado,
    max_productos: historico.CONFIG.MAX_PRODUCTOS_SIN_FILTRO,
    resumen,
    periodos: totales,
    detalle,
    modelo: { version: versionModelo ?? demanda.VERSION_MODELO, nombre: demanda.NOMBRE_MODELO },
  };
}

module.exports = { compararPrediccionVsVentas };
