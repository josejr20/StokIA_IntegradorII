'use strict';

/**
 * HU-72: Servicio de prediccion de demanda.
 * HU-78: Usa los parametros del modelo ML activo, cuando estan disponibles.
 * HU-116 / US-22: Excluye temporalmente ventas asociadas a alertas de
 * anomalias no descartadas. Las ventas siguen intactas en la base de datos.
 *
 * Se consideran ventas netas de origen manual e importado.
 * El filtro de anomalias se aplica ANTES de construir la serie de prediccion.
 */
const modelo = require('./prediccionDemandaModelo');
const { filtrarVentasPorAlertas } = require('./filtroAnomaliasPrediccion');

const ORIGENES_VENTA = ['manual', 'importado'];
const ESTADOS_EXCLUIDOS = ['nueva', 'vista', 'atendida'];

// Carga diferida de Sequelize: permite probar el servicio con repositorios simulados.
function repositorioPorDefecto() {
  const { Venta, Producto, Alerta } = require('../models');
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
      // Es necesario el ID real para excluir unicamente la venta anomala.
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

    // Si el repositorio ML no esta disponible, se usan los parametros por defecto.
    modeloActivo: async () => {
      try {
        return await require('./mlModeloRepositorio').obtenerModeloActivo();
      } catch {
        return null;
      }
    },
  };
}

/**
 * Predice varios productos consultando cada fuente una sola vez.
 * HU-116: Filtra alertas antes de predecir; los errores de consulta de
 * alertas se propagan para evitar una prediccion incorrecta sin filtrar.
 * HU-78: Recupera opcionalmente los parametros del modelo activo.
 * Los repositorios de pruebas antiguos pueden omitir alertas y modeloActivo.
 */
async function predecirProductos(productoIds, {
  horizonte = modelo.CONFIG.HORIZONTE_DEFECTO,
  ahora = new Date(),
  repositorio,
} = {}) {
  const repo = repositorio ?? repositorioPorDefecto();
  const hasta = modelo.ultimoDiaCompleto(ahora);
  const rango = modelo.rangoConsultaUtc(hasta);

  const consultas = [
    repo.productos(productoIds),
    repo.ventas(productoIds, rango.desde, rango.hasta),
    typeof repo.alertas === 'function' ? repo.alertas(productoIds) : Promise.resolve([]),
    typeof repo.modeloActivo === 'function' ? repo.modeloActivo() : Promise.resolve(null),
  ];

  const [productos, ventas, alertas, modeloActivo] = await Promise.all(consultas);
  const { ventasValidas, ventasExcluidas, excluidosPorProducto } =
    filtrarVentasPorAlertas(ventas, alertas);

  const parametros = modeloActivo?.parametros;
  const versionModelo = typeof modeloActivo?.version === 'number'
    ? `v${modeloActivo.version}`
    : modeloActivo?.version;

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

    const prediccion = modelo.predecirDemanda(ventasPorProducto.get(id) ?? [], {
      horizonte,
      hasta,
      parametros,
      versionModelo,
    });

    return {
      producto_id: id,
      producto: {
        id: Number(producto.id),
        codigo: producto.codigo,
        nombre: producto.nombre,
        activo: producto.activo,
      },
      ...prediccion,
      calidad_datos: {
        ventas_anomalas_excluidas: excluidosPorProducto.get(String(id)) ?? 0,
      },
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
