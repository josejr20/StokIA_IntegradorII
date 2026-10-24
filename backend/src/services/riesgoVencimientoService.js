'use strict';

/**
 * HU-98 · BE-01 / BE-03 — Servicio de riesgo de vencimiento.
 * Junta los lotes con stock, la demanda estimada (HU-72) y las fechas de vencimiento.
 *
 * BE-03 (actualizar el riesgo cuando cambien los datos base): el riesgo se calcula en el
 * momento de cada consulta con los lotes, ventas y fechas actuales. No se guarda una copia
 * que pueda quedar desactualizada, así que cualquier cambio se refleja en la consulta siguiente.
 */

const riesgo = require('./riesgoVencimientoModelo');
const { fechaLima } = require('./prediccionDemandaModelo');

const NIVELES_FILTRO = ['alto', 'medio', 'bajo', 'datos_insuficientes'];

// Acceso a datos separado para poder reemplazarlo en las pruebas.
function repositorioPorDefecto() {
  const { Lote, Producto } = require('../models');
  const { Op } = require('sequelize');
  return {
    lotes: (productoIds) => Lote.findAll({
      where: {
        cantidad_actual: { [Op.gt]: 0 },
        ...(productoIds ? { producto_id: { [Op.in]: productoIds } } : {}),
      },
      attributes: ['id', 'producto_id', 'numero_lote', 'cantidad_actual', 'fecha_vencimiento'],
      order: [['fecha_vencimiento', 'ASC'], ['id', 'ASC']],
      raw: true,
    }),
    productos: (ids) => Producto.findAll({
      where: { id: { [Op.in]: ids } },
      attributes: ['id', 'codigo', 'nombre', 'activo'],
      raw: true,
    }),
  };
}

const predictorPorDefecto = (ids, opciones) => require('./prediccionDemandaService').predecirProductos(ids, opciones);

/**
 * productoIds (opcional): limita el análisis a esos productos.
 * nivel (opcional): 'alto' | 'medio' | 'bajo' | 'datos_insuficientes' filtra la lista de productos
 *   (el resumen siempre cuenta todos los lotes).
 */
async function analizarRiesgo({
  productoIds = null,
  nivel = null,
  ahora = new Date(),
  repositorio,
  predictor = predictorPorDefecto,
} = {}) {
  const repo = repositorio ?? repositorioPorDefecto();
  const hoy = fechaLima(ahora);

  const lotes = await repo.lotes(productoIds);
  const lotesPorProducto = new Map();
  for (const lote of lotes) {
    const id = Number(lote.producto_id);
    if (!lotesPorProducto.has(id)) lotesPorProducto.set(id, []);
    lotesPorProducto.get(id).push({ ...lote, id: Number(lote.id) });
  }

  // Solo hace falta estimar demanda de los productos con algún lote que aún no venció.
  let diasMaximos = 0;
  const idsConDemanda = [];
  for (const [id, lotesDelProducto] of lotesPorProducto) {
    let maximo = 0;
    for (const lote of lotesDelProducto) {
      const vencimiento = riesgo.aIso(lote.fecha_vencimiento);
      if (vencimiento) maximo = Math.max(maximo, riesgo.diasEntre(hoy, vencimiento));
    }
    if (maximo > 0) {
      idsConDemanda.push(id);
      diasMaximos = Math.max(diasMaximos, maximo);
    }
  }

  const demandaPorProducto = new Map();
  if (idsConDemanda.length > 0) {
    const horizonte = Math.min(riesgo.CONFIG.HORIZONTE_MAX_DIAS, diasMaximos);
    const prediccion = await predictor(idsConDemanda, { horizonte, ahora });
    for (const resultado of prediccion.resultados) demandaPorProducto.set(resultado.producto_id, resultado);
  }

  const idsProductos = [...lotesPorProducto.keys()];
  const productos = idsProductos.length > 0 ? await repo.productos(idsProductos) : [];
  const productoPorId = new Map(productos.map((producto) => [Number(producto.id), producto]));

  const resumen = { productos_analizados: 0, lotes_analizados: 0, alto: 0, medio: 0, bajo: 0, datos_insuficientes: 0 };
  const analizados = [];

  for (const [id, lotesDelProducto] of lotesPorProducto) {
    const demanda = demandaPorProducto.get(id) ?? null;
    const evaluados = riesgo.evaluarLotes(lotesDelProducto, demanda, hoy);
    if (evaluados.length === 0) continue;

    for (const lote of evaluados) resumen[lote.estado === 'ok' ? lote.nivel : 'datos_insuficientes'] += 1;
    resumen.lotes_analizados += evaluados.length;
    resumen.productos_analizados += 1;

    const consolidado = riesgo.consolidarProducto(evaluados);
    const producto = productoPorId.get(id);
    analizados.push({
      producto_id: id,
      producto: producto
        ? { id: Number(producto.id), codigo: producto.codigo, nombre: producto.nombre, activo: producto.activo }
        : null,
      nivel: consolidado.nivel,
      motivo: consolidado.motivo,
      unidades_en_riesgo: consolidado.unidades_en_riesgo,
      demanda: demanda
        ? { estado: demanda.estado, promedio_diario: demanda.promedio_diario ?? null, confianza: demanda.confianza ?? null }
        : { estado: 'no_calculada', promedio_diario: null, confianza: null },
      lotes: evaluados,
    });
  }

  const primerVencimiento = (producto) => producto.lotes.find((lote) => lote.dias_para_vencer !== null)?.dias_para_vencer ?? Infinity;
  const productosOrdenados = analizados
    .filter((producto) => !nivel || producto.nivel === nivel)
    .sort((a, b) => riesgo.ORDEN_NIVEL[a.nivel] - riesgo.ORDEN_NIVEL[b.nivel] || primerVencimiento(a) - primerVencimiento(b));

  return {
    generado_en: ahora.toISOString(),
    fecha_analisis: hoy,
    criterios: {
      umbral_alto: riesgo.CONFIG.UMBRAL_ALTO,
      umbral_medio: riesgo.CONFIG.UMBRAL_MEDIO,
      dias_urgente: riesgo.CONFIG.DIAS_URGENTE,
    },
    resumen,
    productos: productosOrdenados,
  };
}

module.exports = { analizarRiesgo, NIVELES_FILTRO };
