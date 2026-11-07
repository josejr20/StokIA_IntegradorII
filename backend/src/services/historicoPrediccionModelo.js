'use strict';

/**
 * HU-128 (US-25) · Módulo puro — histórico de predicciones vs ventas reales.
 *
 * Sin base de datos: recibe las ventas de un producto y devuelve, por periodo, la demanda que el
 * modelo HABRÍA predicho con lo que se sabía el día anterior al periodo, la venta real y la
 * diferencia porcentual entre ambas. Es una prueba hacia atrás ("backtest") con el mismo modelo
 * de HU-72, así que no depende de que se hayan guardado predicciones pasadas.
 *
 * Convención de la diferencia:  diferencia = predicción - venta real
 *   > 0  el modelo sobreestimó la demanda      < 0  la subestimó
 *   diferencia_pct = diferencia / venta real × 100  (solo si la venta real es mayor a 0)
 *
 * Los días se agrupan en hora de Lima, igual que la predicción (HU-72).
 */

const demanda = require('./prediccionDemandaModelo');

const CONFIG = Object.freeze({
  PERIODOS_PERMITIDOS: Object.freeze([1, 7, 14, 30]), // días por periodo
  PERIODO_DEFECTO: 7,
  RANGO_DEFECTO_DIAS: 84, // 12 semanas
  RANGO_MAX_DIAS: 365,
  MAX_PERIODOS: 26,
  MAX_PRODUCTOS_SIN_FILTRO: 100, // sin filtro de producto se muestran los de mayor venta
});

const MS_DIA = 24 * 60 * 60 * 1000;

class ErrorHistorico extends Error {
  constructor(mensaje, status = 400) {
    super(mensaje);
    this.name = 'ErrorHistorico';
    this.status = status;
  }
}

const redondear = (valor, decimales = 2) => {
  const factor = 10 ** decimales;
  return Math.round((valor + Number.EPSILON) * factor) / factor;
};

const aUtc = (iso) => {
  const [anio, mes, dia] = iso.split('-').map(Number);
  return Date.UTC(anio, mes - 1, dia);
};

/** Días entre dos fechas ISO (isoB - isoA). */
const diasEntre = (isoA, isoB) => Math.round((aUtc(isoB) - aUtc(isoA)) / MS_DIA);

/** ¿Es una fecha real con formato YYYY-MM-DD? (rechaza 2026-02-30). */
function esFechaIso(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const fecha = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
}

// ---------------------------------------------------------------- filtros (TC-06)

/**
 * Valida y completa los filtros. `query` viene de la URL (todo texto).
 * Devuelve { productoId, desde, hasta, periodoDias, hastaAjustado }.
 */
function validarFiltros(query = {}, ahora = new Date()) {
  const ultimo = demanda.ultimoDiaCompleto(ahora);

  let productoId = null;
  if (query.producto_id !== undefined && query.producto_id !== null && String(query.producto_id).trim() !== '') {
    const numero = Number(query.producto_id);
    if (!Number.isSafeInteger(numero) || numero <= 0) throw new ErrorHistorico('El producto seleccionado no es válido.');
    productoId = numero;
  }

  let periodoDias = CONFIG.PERIODO_DEFECTO;
  if (query.periodo_dias !== undefined && query.periodo_dias !== null && String(query.periodo_dias).trim() !== '') {
    periodoDias = Number(query.periodo_dias);
    if (!CONFIG.PERIODOS_PERMITIDOS.includes(periodoDias)) {
      throw new ErrorHistorico(`El periodo debe ser de ${CONFIG.PERIODOS_PERMITIDOS.join(', ')} días.`);
    }
  }

  const hayHasta = query.hasta !== undefined && query.hasta !== null && String(query.hasta).trim() !== '';
  const hayDesde = query.desde !== undefined && query.desde !== null && String(query.desde).trim() !== '';
  if (hayHasta && !esFechaIso(String(query.hasta).trim())) throw new ErrorHistorico('La fecha final no es válida (use AAAA-MM-DD).');
  if (hayDesde && !esFechaIso(String(query.desde).trim())) throw new ErrorHistorico('La fecha inicial no es válida (use AAAA-MM-DD).');

  // Solo se comparan días completos: el día en curso todavía no terminó.
  let hasta = hayHasta ? String(query.hasta).trim() : ultimo;
  let hastaAjustado = false;
  if (hasta > ultimo) { hasta = ultimo; hastaAjustado = true; }

  const desde = hayDesde ? String(query.desde).trim() : demanda.sumarDias(hasta, -(CONFIG.RANGO_DEFECTO_DIAS - 1));
  if (desde > hasta) throw new ErrorHistorico('La fecha inicial no puede ser posterior a la final.');
  const dias = diasEntre(desde, hasta) + 1;
  if (dias > CONFIG.RANGO_MAX_DIAS) throw new ErrorHistorico(`El rango no puede superar ${CONFIG.RANGO_MAX_DIAS} días.`);

  return { productoId, desde, hasta, periodoDias, hastaAjustado };
}

/** Periodos consecutivos y completos de `periodoDias` días a partir de `desde`. */
function construirPeriodos(desde, hasta, periodoDias) {
  const periodos = [];
  for (let inicio = desde; demanda.sumarDias(inicio, periodoDias - 1) <= hasta; inicio = demanda.sumarDias(inicio, periodoDias)) {
    periodos.push({ inicio, fin: demanda.sumarDias(inicio, periodoDias - 1) });
  }
  if (periodos.length === 0) {
    throw new ErrorHistorico(`El rango seleccionado es menor que un periodo de ${periodoDias} día(s).`);
  }
  if (periodos.length > CONFIG.MAX_PERIODOS) {
    throw new ErrorHistorico(`El rango abarca ${periodos.length} periodos y el máximo es ${CONFIG.MAX_PERIODOS}. Acorte el rango o use periodos más largos.`);
  }
  return periodos;
}

/** Rango UTC [desde, hasta) que hay que consultar: los periodos más los días de historial que usa el modelo. */
function rangoConsulta(desde, hasta) {
  const ventana = diasEntre(desde, hasta) + 1 + demanda.CONFIG.VENTANA_DIAS;
  return demanda.rangoConsultaUtc(hasta, ventana);
}

// ---------------------------------------------------------------- comparación (TC-03, TC-04, TC-07)

/**
 * Compara un producto en un periodo. `ventas` = [{ fecha_venta, cantidad }] del producto
 * (incluyendo los días anteriores al periodo, que el modelo usa como historial).
 *
 * estado:
 *  - 'ok'        hay predicción y venta real  -> se calcula la diferencia.
 *  - 'sin_datos' falta algo: `motivo` = 'sin_ventas_reales' (TC-02) o 'historial_insuficiente'.
 */
function compararPeriodo(ventas, periodo, { periodoDias, parametros, versionModelo } = {}) {
  let ventaReal = 0;
  let filasReales = 0;
  for (const venta of ventas) {
    const fecha = new Date(venta.fecha_venta);
    const cantidad = Number(venta.cantidad);
    if (Number.isNaN(fecha.getTime()) || !Number.isFinite(cantidad)) continue;
    const dia = demanda.fechaLima(fecha);
    if (dia >= periodo.inicio && dia <= periodo.fin) {
      ventaReal += cantidad;
      filasReales += 1;
    }
  }

  const resultado = demanda.predecirDemanda(ventas, {
    horizonte: periodoDias,
    hasta: demanda.sumarDias(periodo.inicio, -1), // solo lo que se sabía antes del periodo
    parametros,
    versionModelo,
  });
  const prediccion = resultado.estado === 'ok' ? redondear(resultado.demanda_estimada) : null;
  const real = filasReales > 0 ? redondear(ventaReal) : null;

  const base = { periodo_inicio: periodo.inicio, periodo_fin: periodo.fin, prediccion, venta_real: real };

  if (real === null) {
    return {
      ...base, diferencia: null, diferencia_pct: null, estado: 'sin_datos', motivo: 'sin_ventas_reales',
      mensaje: 'No hay datos suficientes para ese periodo: no se registraron ventas reales.',
    };
  }
  if (prediccion === null) {
    return {
      ...base, diferencia: null, diferencia_pct: null, estado: 'sin_datos', motivo: 'historial_insuficiente',
      mensaje: 'No hay datos suficientes para ese periodo: el modelo no tenía historial suficiente para predecir.',
    };
  }
  const diferencia = redondear(prediccion - real);
  return {
    ...base,
    diferencia,
    diferencia_pct: real > 0 ? redondear((diferencia / real) * 100) : null,
    estado: 'ok',
    motivo: null,
    mensaje: null,
  };
}

/** Totales por periodo: solo suman las filas comparables, para que la gráfica compare lo mismo con lo mismo. */
function agregarPorPeriodo(periodos, detalle) {
  return periodos.map((periodo) => {
    const filas = detalle.filter((fila) => fila.periodo_inicio === periodo.inicio);
    const comparables = filas.filter((fila) => fila.estado === 'ok');
    if (comparables.length === 0) {
      const sinVentas = filas.length > 0 && filas.every((fila) => fila.motivo === 'sin_ventas_reales');
      return {
        periodo_inicio: periodo.inicio, periodo_fin: periodo.fin,
        prediccion: null, venta_real: null, diferencia: null, diferencia_pct: null,
        estado: 'sin_datos', productos_comparados: 0,
        mensaje: sinVentas || filas.length === 0
          ? 'No hay datos suficientes para ese periodo: no se registraron ventas reales.'
          : 'No hay datos suficientes para ese periodo.',
      };
    }
    const prediccion = redondear(comparables.reduce((suma, fila) => suma + fila.prediccion, 0));
    const ventaReal = redondear(comparables.reduce((suma, fila) => suma + fila.venta_real, 0));
    const diferencia = redondear(prediccion - ventaReal);
    return {
      periodo_inicio: periodo.inicio, periodo_fin: periodo.fin,
      prediccion, venta_real: ventaReal, diferencia,
      diferencia_pct: ventaReal > 0 ? redondear((diferencia / ventaReal) * 100) : null,
      estado: 'ok', productos_comparados: comparables.length, mensaje: null,
    };
  });
}

/**
 * Precisión global del modelo en lo comparado.
 * WAPE = Σ|predicción - real| / Σ real × 100  (error porcentual ponderado).
 */
function resumir(detalle) {
  const comparables = detalle.filter((fila) => fila.estado === 'ok');
  const sumaReal = comparables.reduce((suma, fila) => suma + fila.venta_real, 0);
  const sumaAbsoluta = comparables.reduce((suma, fila) => suma + Math.abs(fila.diferencia), 0);
  const sumaPrediccion = comparables.reduce((suma, fila) => suma + fila.prediccion, 0);
  const wape = sumaReal > 0 ? (sumaAbsoluta / sumaReal) * 100 : null;
  return {
    comparaciones: comparables.length,
    sin_datos: detalle.length - comparables.length,
    error_porcentual_ponderado: wape === null ? null : redondear(wape),
    precision_pct: wape === null ? null : redondear(Math.max(0, 100 - wape)),
    sesgo_pct: sumaReal > 0 ? redondear(((sumaPrediccion - sumaReal) / sumaReal) * 100) : null,
  };
}

module.exports = {
  CONFIG,
  ErrorHistorico,
  esFechaIso,
  validarFiltros,
  construirPeriodos,
  rangoConsulta,
  compararPeriodo,
  agregarPorPeriodo,
  resumir,
};
