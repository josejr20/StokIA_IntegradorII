'use strict';

/**
 * HU-72: Servicio de prediccion de demanda.
 * HU-116 / US-22: ignora temporalmente ventas identificadas por alertas US-22
 * aun no descartadas. La venta permanece intacta en la base de datos.
 *
 * Solo cuentan ventas netas (manual + importado), como /api/ventas/resumen.
 * El filtro se aplica ANTES de construir la serie de Holt.
 */
const modelo = require('./prediccionDemandaModelo');
const { filtrarVentasPorAlertas } = require('./filtroAnomaliasPrediccion');

const ORIGENES_VENTA = ['manual', 'importado'];
const ESTADOS_EXCLUIDOS = ['nueva', 'vista', 'atendida'];

// Los modelos Sequelize se cargan solo al usarse; las pruebas no abren la BD.
function repositorioPorDefecto() {
  const { Venta, Producto, Alerta } = require('../models');
  const { Op } = require('sequelize');
  return {
    productos: (ids) => Producto.findAll({
      where: { id: { [Op.in]: ids } },
      attributes: ['id', 'codigo', 'nombre', 'activo'],
      raw: true,
    }),
    // HU-78: parámetros del modelo activo (si no hay o falla la consulta, se usan los de defecto).
    modeloActivo: async () => {
      try {
        return await require('./mlModeloRepositorio').obtenerModeloActivo();
      } catch {
        return null;
      }
    },
    ventas: (ids, desde, hastaExclusivo) => Venta.findAll({
      where: {
        producto_id: { [Op.in]: ids },
        origen: { [Op.in]: ORIGENES_VENTA },
        fecha_venta: { [Op.gte]: desde, [Op.lt]: hastaExclusivo },
      },
      // HU-116 necesita el ID real para excluir SOLO el registro anomalo.
      attributes: ['id', 'producto_id', 'cantidad', 'fecha_venta'],
      raw: true,
    }),
    alertas: (ids) => Alerta.findAll({
      where: {
        tipo: 'anomalia',
        estado: { [Op.in]: ESTADOS_EXCLUIDOS },
        producto_id: { [Op.in]: ids },
        datos_origen: { [Op.contains]: { origen: 'us22_detector_local', fuente: 'venta' } },
      },
      attributes: ['tipo', 'estado', 'producto_id', 'datos_origen'],
      raw: true,
    }),
  };
}

/**
 * Predice varios productos con una sola consulta de ventas.
 * Se consultan sus alertas del detector US-22 y se excluyen por ID de venta.
 * Repositorios de pruebas antiguas sin metodo alertas siguen funcionando.
 * Si la consulta real de alertas falla, NO se generan predicciones sin filtrar:
 * el error se propaga para no ocultar el problema.
 */
async function predecirProductos(productoIds, {
  horizonte = modelo.CONFIG.HORIZONTE_DEFECTO,
  ahora = new Date(),
  repositorio,
} = {}) {
  const repo = repositorio ?? repositorioPorDefecto();
  const hasta = modelo.ultimoDiaCompleto(ahora);
  const rango = modelo.rangoConsultaUtc(hasta);

  const [productos, ventas, alertas, modeloActivo] = await Promise.all([
    repo.productos(productoIds),
    repo.ventas(productoIds, rango.desde, rango.hasta),
    typeof repo.alertas === 'function' ? repo.alertas(productoIds) : [],
    repo.modeloActivo ? repo.modeloActivo() : null,
  ]);
  const { ventasValidas, ventasExcluidas, excluidosPorProducto } =
    filtrarVentasPorAlertas(ventas, alertas);
  const parametros = modeloActivo?.parametros;
  const versionModelo = typeof modeloActivo?.version === 'number' ? `v${modeloActivo.version}` : modeloActivo?.version;

  const productoPorId = new Map(productos.map((producto) => [Number(producto.id), producto]));
  const ventasPorProducto = new Map();
  for (const venta of ventasValidas) {
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
      calidad_datos: {
        ventas_anomalas_excluidas: excluidosPorProducto.get(String(id)) ?? 0,
      },
      ...modelo.predecirDemanda(ventasPorProducto.get(id) ?? [], { horizonte, hasta, parametros, versionModelo }),
    };
  });

  return {
    generado_en: ahora.toISOString(),
    horizonte_dias: horizonte,
    ultimo_dia_analizado: hasta,
    calidad_datos: {
      total_ventas_anomalas_excluidas: ventasExcluidas.length,
    },
    resultados,
  };
}

/** Prediccion de un producto. */
async function predecirProducto(productoId, horizonteDias, opciones = {}) {
  const horizonte = modelo.normalizarHorizonte(horizonteDias);
  const respuesta = await predecirProductos([Number(productoId)], { ...opciones, horizonte });
  return respuesta.resultados[0];
}

module.exports = { predecirProductos, predecirProducto, ORIGENES_VENTA };
