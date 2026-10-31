'use strict';

/**
 * HU-78 · ML-01 y ML-02 — Entrenamiento y evaluación del modelo de demanda.
 *
 * Módulo puro (sin base de datos). "Entrenar" = elegir, con el historial de ventas, los parámetros
 * de suavizado (alpha, beta, phi) del modelo de HU-72 que mejor predicen la demanda.
 *
 * Método (prueba hacia atrás, "backtest"):
 *  1. Se arma la serie diaria de ventas de cada producto (los mismos datos que usa la predicción).
 *  2. Se simulan predicciones pasadas: en cada fecha de corte ("origen") se predice la demanda de
 *     los 7 días siguientes con lo que se sabía hasta ese día y se compara con lo que se vendió.
 *  3. Se prueban todas las combinaciones de parámetros de la grilla y se elige la de menor RMSE
 *     sobre los orígenes más antiguos.
 *  4. Las métricas que se reportan (MAE, RMSE y RMSE relativo) se miden sobre los últimos
 *     orígenes, que no participaron en la elección. Si hay muy pocos datos para separarlos, se
 *     usan todos y se avisa de que las métricas son optimistas.
 *
 *  Error de cada evaluación = demanda predicha de 7 días - demanda real de 7 días (en unidades).
 *  MAE = promedio de |error|;  RMSE = raíz del promedio de error²;
 *  RMSE relativo = RMSE / demanda real promedio de 7 días  (se compara con el umbral aceptable).
 */

const demanda = require('./prediccionDemandaModelo');

const CONFIG_ML = Object.freeze({
  UMBRAL_RMSE_RELATIVO: 0.3, // desempeño aceptable: RMSE relativo <= 30 %
  HORIZONTE_EVALUACION: 7, // días que se predicen en cada prueba
  PASO_ORIGEN: 3, // se prueba un origen cada 3 días
  DIAS_VALIDACION: 14, // los orígenes de los últimos 14 días se reservan para medir
  VENTANA_ENTRENAMIENTO_DIAS: 180, // cuánto historial de ventas se carga
  MIN_EVALUACIONES: 10, // mínimo de pruebas para poder entrenar o evaluar
  DIAS_EVALUACION_RECIENTE: 28, // TC-07: desempeño del modelo activo sobre los últimos 28 días
  GRILLA: Object.freeze({
    alpha: [0.1, 0.05, 0.15, 0.2, 0.3],
    beta: [0.01, 0, 0.03, 0.05],
    phi: [0.9, 0.8, 0.98],
  }),
});

const redondear = (valor, decimales) => {
  const factor = 10 ** decimales;
  return Math.round((valor + Number.EPSILON) * factor) / factor;
};

/** Candidatos de la grilla. Los valores por defecto van primero: en un empate se queda con ellos. */
function candidatos(grilla = CONFIG_ML.GRILLA) {
  const lista = [];
  for (const alpha of grilla.alpha) {
    for (const beta of grilla.beta) {
      for (const phi of grilla.phi) lista.push({ alpha, beta, phi });
    }
  }
  return lista;
}

// ---------------------------------------------------------------- datos preparados

/** ventas: [{ producto_id, cantidad, fecha_venta }] -> Map(producto_id -> info de la serie diaria). */
function prepararSeries(ventas, hasta, ventanaDias = CONFIG_ML.VENTANA_ENTRENAMIENTO_DIAS) {
  const porProducto = new Map();
  for (const venta of ventas) {
    const id = Number(venta.producto_id);
    if (!porProducto.has(id)) porProducto.set(id, []);
    porProducto.get(id).push(venta);
  }
  const series = new Map();
  for (const [id, filas] of porProducto) {
    const info = demanda.construirSerie(filas, hasta, ventanaDias);
    if (info.serie.length > 0) series.set(id, info);
  }
  return series;
}

/**
 * Pruebas posibles: cada una tiene lo que se sabía en la fecha de corte (`serie`, igual que en una
 * predicción real) y lo que realmente se vendió en los 7 días siguientes (`real`).
 * Solo cuentan los orígenes en los que el producto tenía historial suficiente (misma regla de HU-72).
 */
function construirEvaluaciones(series, { horizonte, paso, desdeOrigen = null }) {
  const evaluaciones = [];
  for (const [productoId, info] of series) {
    const completa = info.serie;
    for (let i = completa.length - 1 - horizonte; i >= 0; i -= paso) {
      const origen = completa[i].fecha;
      if (desdeOrigen && origen < desdeOrigen) break;

      let ventana = completa.slice(Math.max(0, i - (demanda.CONFIG.VENTANA_DIAS - 1)), i + 1);
      const primero = ventana.findIndex((punto) => punto.cantidad > 0);
      if (primero < 0) continue;
      ventana = ventana.slice(primero);

      const diasConVentas = ventana.reduce((cuenta, punto) => cuenta + (punto.cantidad > 0 ? 1 : 0), 0);
      if (!demanda.evaluarSuficiencia({ serie: ventana, diasConVentas }).suficiente) continue;

      let real = 0;
      for (let k = 1; k <= horizonte; k += 1) real += completa[i + k].cantidad;
      evaluaciones.push({ producto_id: productoId, origen, serie: ventana, real, precalculo: demanda.prepararPrecalculo(ventana) });
    }
  }
  return evaluaciones;
}

// ---------------------------------------------------------------- métricas

function predichoTotal(evaluacion, parametros, horizonte) {
  return demanda.pronosticarTotal(evaluacion.serie, horizonte, evaluacion.origen, parametros, evaluacion.precalculo);
}

/** ML-02 / TC-04: MAE, RMSE y RMSE relativo a partir de pares { predicho, real }. */
function calcularMetricas(pares) {
  const n = pares.length;
  if (n === 0) return { evaluaciones: 0, mae: null, rmse: null, demanda_promedio: null, rmse_relativo: null };
  let absolutos = 0;
  let cuadrados = 0;
  let reales = 0;
  for (const { predicho, real } of pares) {
    const error = predicho - real;
    absolutos += Math.abs(error);
    cuadrados += error * error;
    reales += real;
  }
  const rmse = Math.sqrt(cuadrados / n);
  const promedio = reales / n;
  return {
    evaluaciones: n,
    mae: redondear(absolutos / n, 2),
    rmse: redondear(rmse, 2),
    demanda_promedio: redondear(promedio, 2),
    rmse_relativo: promedio > 0 ? redondear(rmse / promedio, 4) : null,
  };
}

const paresDe = (evaluaciones, parametros, horizonte) => {
  const p = demanda.normalizarParametros(parametros);
  return evaluaciones.map((evaluacion) => ({ predicho: predichoTotal(evaluacion, p, horizonte), real: evaluacion.real }));
};

function rmseDe(evaluaciones, parametros, horizonte) {
  const p = demanda.normalizarParametros(parametros);
  let cuadrados = 0;
  for (const evaluacion of evaluaciones) {
    const error = predichoTotal(evaluacion, p, horizonte) - evaluacion.real;
    cuadrados += error * error;
  }
  return Math.sqrt(cuadrados / evaluaciones.length);
}

const cumpleUmbral = (metricas, config) =>
  metricas.rmse_relativo !== null && metricas.rmse_relativo <= config.UMBRAL_RMSE_RELATIVO;

function resumenDatos(series, ventas, hasta) {
  let desde = null;
  for (const info of series.values()) if (info.desde && (!desde || info.desde < desde)) desde = info.desde;
  return { desde, hasta, filas_ventas: ventas.length, productos_con_ventas: series.size };
}

function mensajeDatosInsuficientes(evaluaciones, config) {
  return (
    `No hay datos históricos suficientes: se lograron ${evaluaciones} pruebas de predicción y se necesitan al menos ` +
    `${config.MIN_EVALUACIONES}. Cada producto necesita al menos ${demanda.CONFIG.MIN_DIAS_HISTORIAL + config.HORIZONTE_EVALUACION} ` +
    `días de historial y ${demanda.CONFIG.MIN_DIAS_CON_VENTAS} días con ventas.`
  );
}

// ---------------------------------------------------------------- entrenar / evaluar

/**
 * ML-01 / TC-03: entrena con el historial de ventas.
 * Devuelve { ok: false, motivo, mensaje } si no hay datos, o el modelo entrenado con sus métricas.
 */
function entrenar(ventas, { hasta, config = CONFIG_ML } = {}) {
  const series = prepararSeries(ventas, hasta, config.VENTANA_ENTRENAMIENTO_DIAS);
  const datos = resumenDatos(series, ventas, hasta);
  const evaluaciones = construirEvaluaciones(series, { horizonte: config.HORIZONTE_EVALUACION, paso: config.PASO_ORIGEN });

  if (evaluaciones.length < config.MIN_EVALUACIONES) {
    return {
      ok: false,
      motivo: 'datos_insuficientes',
      mensaje: mensajeDatosInsuficientes(evaluaciones.length, config),
      datos,
      evaluaciones: evaluaciones.length,
    };
  }

  // Los orígenes más recientes se reservan para medir; los anteriores sirven para elegir parámetros.
  const corte = demanda.sumarDias(hasta, -(config.HORIZONTE_EVALUACION + config.DIAS_VALIDACION));
  const paraElegir = evaluaciones.filter((evaluacion) => evaluacion.origen <= corte);
  const paraMedir = evaluaciones.filter((evaluacion) => evaluacion.origen > corte);
  const independiente = paraElegir.length >= config.MIN_EVALUACIONES && paraMedir.length >= config.MIN_EVALUACIONES;
  const conjuntoElegir = independiente ? paraElegir : evaluaciones;
  const conjuntoMedir = independiente ? paraMedir : evaluaciones;

  const lista = candidatos(config.GRILLA);
  let mejor = null;
  for (const parametros of lista) {
    const rmse = rmseDe(conjuntoElegir, parametros, config.HORIZONTE_EVALUACION);
    if (mejor === null || rmse < mejor.rmse) mejor = { parametros, rmse };
  }

  const metricas = calcularMetricas(paresDe(conjuntoMedir, mejor.parametros, config.HORIZONTE_EVALUACION));
  const referencia = calcularMetricas(paresDe(conjuntoMedir, demanda.PARAMETROS_POR_DEFECTO, config.HORIZONTE_EVALUACION));

  return {
    ok: true,
    parametros: mejor.parametros,
    metricas,
    referencia, // parámetros por defecto medidos sobre las mismas pruebas, para comparar
    aprobado: cumpleUmbral(metricas, config),
    umbral_rmse_relativo: config.UMBRAL_RMSE_RELATIVO,
    validacion: independiente ? 'independiente' : 'mismos_datos',
    pruebas: { total: evaluaciones.length, para_elegir: conjuntoElegir.length, para_medir: conjuntoMedir.length },
    productos_evaluados: new Set(conjuntoMedir.map((evaluacion) => evaluacion.producto_id)).size,
    candidatos_probados: lista.length,
    datos,
  };
}

/**
 * TC-07: mide qué tan bien predicen unos parámetros sobre el historial RECIENTE (últimos N días),
 * por ejemplo los del modelo activo, y dice si siguen cumpliendo el umbral.
 */
function evaluarParametros(ventas, parametros, { hasta, config = CONFIG_ML, dias = config.DIAS_EVALUACION_RECIENTE } = {}) {
  const series = prepararSeries(ventas, hasta, config.VENTANA_ENTRENAMIENTO_DIAS);
  const desdeOrigen = demanda.sumarDias(hasta, -(config.HORIZONTE_EVALUACION + dias));
  const evaluaciones = construirEvaluaciones(series, { horizonte: config.HORIZONTE_EVALUACION, paso: 1, desdeOrigen });

  if (evaluaciones.length < config.MIN_EVALUACIONES) {
    return {
      ok: false,
      motivo: 'datos_insuficientes',
      mensaje: mensajeDatosInsuficientes(evaluaciones.length, config),
      evaluaciones: evaluaciones.length,
    };
  }
  const metricas = calcularMetricas(paresDe(evaluaciones, parametros, config.HORIZONTE_EVALUACION));
  return {
    ok: true,
    metricas,
    aprobado: cumpleUmbral(metricas, config),
    umbral_rmse_relativo: config.UMBRAL_RMSE_RELATIVO,
    dias_evaluados: dias,
    productos_evaluados: new Set(evaluaciones.map((evaluacion) => evaluacion.producto_id)).size,
  };
}

module.exports = {
  CONFIG_ML,
  candidatos,
  prepararSeries,
  construirEvaluaciones,
  calcularMetricas,
  entrenar,
  evaluarParametros,
};
