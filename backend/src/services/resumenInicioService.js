'use strict';

const HORIZONTE_PREDICCION_DIAS = 7;
const DIAS_VENTAS_RECIENTES = 30;
const MAX_ALERTAS = 5;
const MAX_PREDICCIONES = 3;
const PRODUCTOS_A_ANALIZAR = 5;

// Qué permisos habilitan cada indicador del resumen.
const PERMISOS_INDICADORES = {
  productos_activos: ['ver_kpis', 'gestionar_productos', 'gestionar_inventario'],
  ventas_mes_actual: ['ver_kpis', 'gestionar_ventas'],
  alertas_activas: ['ver_alertas'],
  alertas_criticas: ['ver_alertas'],
  stock_bajo: ['ver_alertas'],
  ordenes_pendientes: ['ver_kpis', 'gestionar_reabastecimiento'],
};
const PERMISOS_ALERTAS = ['ver_alertas'];
const PERMISOS_PREDICCIONES = ['ver_kpis'];

function tieneAlguno(permisos, requeridos) {
  if (permisos.todos) return true;
  return requeridos.some((codigo) => permisos.codigos.has(codigo));
}

/** Predicciones más relevantes: productos más vendidos cuya demanda estimada supera el stock disponible. */
async function calcularPrediccionesRelevantes(repositorio, ahora) {
  const desde = new Date(ahora.getTime() - DIAS_VENTAS_RECIENTES * 24 * 60 * 60 * 1000);
  const ids = await repositorio.productosMasVendidos(desde, PRODUCTOS_A_ANALIZAR);
  if (!ids.length) return [];

  const [prediccion, stock] = await Promise.all([
    repositorio.predecir(ids, HORIZONTE_PREDICCION_DIAS),
    repositorio.stockPorProducto(ids),
  ]);

  return prediccion.resultados
    .filter((resultado) => resultado.estado === 'ok' && resultado.producto)
    .map((resultado) => {
      const disponible = stock.get(resultado.producto_id) ?? 0;
      return {
        producto_id: resultado.producto_id,
        codigo: resultado.producto.codigo,
        nombre: resultado.producto.nombre,
        horizonte_dias: HORIZONTE_PREDICCION_DIAS,
        demanda_estimada: resultado.demanda_estimada,
        stock_disponible: disponible,
        faltante: Math.round((resultado.demanda_estimada - disponible) * 100) / 100,
        tendencia: resultado.tendencia ?? null,
      };
    })
    .filter((item) => item.faltante > 0)
    .sort((a, b) => b.faltante - a.faltante)
    .slice(0, MAX_PREDICCIONES);
}

async function construirResumenInicio({ permisos, repositorio, ahora = new Date(), logger = null }) {
  const kpis = {};
  const consultas = {
    productos_activos: () => repositorio.contarProductosActivos(),
    ventas_mes_actual: () => repositorio.ventasDelMes(ahora),
    alertas_activas: () => repositorio.contarAlertasActivas({}),
    alertas_criticas: () => repositorio.contarAlertasActivas({ severidad: 'critica' }),
    stock_bajo: () => repositorio.contarAlertasActivas({ tipo: 'bajo_stock' }),
    ordenes_pendientes: () => repositorio.contarOrdenesPendientes(),
  };
  for (const [clave, requeridos] of Object.entries(PERMISOS_INDICADORES)) {
    if (tieneAlguno(permisos, requeridos)) kpis[clave] = await consultas[clave]();
  }

  const alertasRecientes = tieneAlguno(permisos, PERMISOS_ALERTAS)
    ? await repositorio.alertasRecientes(MAX_ALERTAS)
    : [];

  // Si la predicción falla, el resumen sigue mostrándose sin ella.
  let prediccionesRelevantes = [];
  if (tieneAlguno(permisos, PERMISOS_PREDICCIONES)) {
    try {
      prediccionesRelevantes = await calcularPrediccionesRelevantes(repositorio, ahora);
    } catch (error) {
      if (logger) logger.warn(`No se pudieron calcular las predicciones del inicio: ${error.message}`);
    }
  }

  return {
    generado_en: ahora.toISOString(),
    alertas_recientes: alertasRecientes,
    predicciones_relevantes: prediccionesRelevantes,
    kpis,
    hay_novedades: alertasRecientes.length > 0 || prediccionesRelevantes.length > 0,
  };
}

module.exports = {
  construirResumenInicio,
  PERMISOS_INDICADORES,
  HORIZONTE_PREDICCION_DIAS,
  MAX_ALERTAS,
  MAX_PREDICCIONES,
};