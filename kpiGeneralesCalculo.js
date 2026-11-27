'use strict';

/**
 * US-34 · KPIs generales del sistema: lógica PURA de cálculo (sin base de datos).
 *
 *  - HU-174: rotación de inventario por periodo.
 *  - HU-175: estimación de mermas evitadas gracias a las alertas de vencimiento.
 *  - TC-02/TC-07: reglas para decidir si hay datos suficientes.
 *
 * Todas las fechas de periodo son 'YYYY-MM-DD' en hora de Perú (UTC-5, sin horario de verano).
 */

const MIN_DIAS_CON_VENTAS = 5; // menos que esto no permite una rotación representativa
const MIN_COBERTURA = 0.5; // el historial debe cubrir al menos la mitad del periodo
const MAX_DIAS_PERIODO = 366;
const PRESETS_DIAS = { '30d': 30, '90d': 90, '180d': 180, '365d': 365 };
const PERIODOS_VALIDOS = [...Object.keys(PRESETS_DIAS), 'mes_actual', 'mes_anterior', 'personalizado'];
const MS_DIA = 86_400_000;
const OFFSET_PERU_MS = -5 * 3_600_000;

class ErrorPeriodo extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = 'ErrorPeriodo';
    this.statusCode = 400;
  }
}

// ---------- utilidades de fecha (aritmética UTC sobre 'YYYY-MM-DD') ----------

const aMs = (fecha) => Date.parse(`${fecha}T00:00:00Z`);
const aFecha = (ms) => new Date(ms).toISOString().slice(0, 10);
const sumarDias = (fecha, dias) => aFecha(aMs(fecha) + dias * MS_DIA);
const diasEntre = (desde, hasta) => Math.round((aMs(hasta) - aMs(desde)) / MS_DIA);
const redondear = (n, d = 2) => Math.round((n + Number.EPSILON) * 10 ** d) / 10 ** d;

function fechaValida(texto) {
  if (typeof texto !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const ms = aMs(texto);
  return !Number.isNaN(ms) && aFecha(ms) === texto; // descarta 2026-02-31
}

/** Fecha de "hoy" en Perú, independientemente de la zona horaria del servidor. */
function hoyEnPeru(ahora = new Date()) {
  return aFecha(ahora.getTime() + OFFSET_PERU_MS);
}

/**
 * TC-06: resuelve el periodo de análisis pedido. Devuelve { tipo, desde, hasta, dias }
 * con `hasta` inclusive. Lanza ErrorPeriodo (HTTP 400) si la petición no es válida.
 */
function resolverPeriodo({ periodo = '90d', desde, hasta } = {}, ahora = new Date()) {
  const hoy = hoyEnPeru(ahora);
  let tipo = periodo || '90d';
  if (desde || hasta) tipo = 'personalizado';
  if (!PERIODOS_VALIDOS.includes(tipo)) {
    throw new ErrorPeriodo(`Periodo no válido. Use: ${PERIODOS_VALIDOS.join(', ')}`);
  }

  let ini;
  let fin;
  if (tipo === 'personalizado') {
    if (!desde || !hasta) throw new ErrorPeriodo('El periodo personalizado requiere "desde" y "hasta"');
    if (!fechaValida(desde) || !fechaValida(hasta)) throw new ErrorPeriodo('Las fechas deben tener el formato AAAA-MM-DD');
    ini = desde;
    fin = hasta;
  } else if (tipo === 'mes_actual') {
    ini = `${hoy.slice(0, 7)}-01`;
    fin = hoy;
  } else if (tipo === 'mes_anterior') {
    const primeroEsteMes = `${hoy.slice(0, 7)}-01`;
    fin = sumarDias(primeroEsteMes, -1);
    ini = `${fin.slice(0, 7)}-01`;
  } else {
    fin = hoy;
    ini = sumarDias(hoy, -(PRESETS_DIAS[tipo] - 1));
  }

  if (ini > fin) throw new ErrorPeriodo('La fecha "desde" no puede ser posterior a "hasta"');
  if (fin > hoy) throw new ErrorPeriodo('El periodo no puede incluir fechas futuras');
  const dias = diasEntre(ini, fin) + 1;
  if (dias > MAX_DIAS_PERIODO) throw new ErrorPeriodo(`El periodo no puede superar ${MAX_DIAS_PERIODO} días`);
  return { tipo, desde: ini, hasta: fin, dias };
}

/**
 * Fechas de corte (inicio de día) en las que se mide el inventario: el inicio del periodo,
 * el comienzo de cada mes intermedio y el cierre. El promedio de esos saldos es el
 * "inventario promedio" de la fórmula de rotación.
 */
function puntosDeMuestreo({ desde, hasta }) {
  const cierre = sumarDias(hasta, 1);
  const puntos = [desde];
  let cursor = `${desde.slice(0, 7)}-01`;
  for (;;) {
    const [anio, mes] = cursor.split('-').map(Number);
    cursor = `${mes === 12 ? anio + 1 : anio}-${String(mes === 12 ? 1 : mes + 1).padStart(2, '0')}-01`;
    if (cursor >= cierre) break;
    if (cursor > desde) puntos.push(cursor);
  }
  puntos.push(cierre);
  return puntos;
}

// ---------- HU-174: rotación de inventario ----------

/**
 * Rotación = costo de ventas del periodo / inventario promedio.
 * Se calcula a costo (kardex valorizado). Si el kardex no tiene costos, se usa
 * la misma fórmula en unidades como respaldo y se informa en `base`.
 */
function calcularRotacion({ costoVentas, unidadesVendidas, snapshots, dias }) {
  const promedio = (campo) => (snapshots.length
    ? snapshots.reduce((s, x) => s + Number(x[campo] || 0), 0) / snapshots.length
    : 0);
  const inventarioValor = promedio('valor');
  const inventarioUnidades = promedio('unidades');

  let base = null;
  let valor = null;
  if (inventarioValor > 0 && costoVentas > 0) {
    base = 'valorizado';
    valor = costoVentas / inventarioValor;
  } else if (inventarioUnidades > 0 && unidadesVendidas > 0) {
    base = 'unidades';
    valor = unidadesVendidas / inventarioUnidades;
  }

  return {
    calculable: valor !== null,
    valor: valor === null ? null : redondear(valor),
    base,
    dias_inventario: valor ? redondear(dias / valor, 1) : null,
    costo_ventas: redondear(costoVentas),
    unidades_vendidas: redondear(unidadesVendidas),
    inventario_promedio_valor: redondear(inventarioValor),
    inventario_promedio_unidades: redondear(inventarioUnidades),
    puntos_muestreo: snapshots.length,
  };
}

// ---------- HU-175: mermas evitadas gracias a las alertas ----------

/**
 * Estimación conservadora de mermas evitadas.
 *
 * Para cada lote con alerta de riesgo de vencimiento ATENDIDA en el periodo se cuentan
 * las unidades vendidas desde que se emitió la alerta hasta la fecha de vencimiento, sin
 * superar las unidades que la alerta marcó en riesgo. Es lo que, sin aviso, habría corrido
 * el riesgo de perderse. Si un lote tuvo varias alertas se cuenta una sola vez.
 * El valor se expresa a costo (costo promedio del kardex en cada salida).
 */
function calcularMermasEvitadas({ alertas, lotes, salidas }) {
  const porLote = new Map();
  for (const alerta of alertas) {
    const enRiesgo = Number(alerta.datos_origen?.unidades_en_riesgo ?? 0);
    if (!alerta.lote_id || !(enRiesgo > 0)) continue;
    const previo = porLote.get(Number(alerta.lote_id));
    const creada = new Date(alerta.fecha_creacion).getTime();
    porLote.set(Number(alerta.lote_id), {
      enRiesgo: Math.max(previo?.enRiesgo ?? 0, enRiesgo),
      desde: Math.min(previo?.desde ?? Infinity, creada),
      alertas: (previo?.alertas ?? 0) + 1,
    });
  }

  let unidades = 0;
  let valor = 0;
  let lotesConMerma = 0;
  let alertasConsideradas = 0;
  for (const [loteId, info] of porLote) {
    alertasConsideradas += info.alertas;
    const vence = lotes.get(loteId)?.fecha_vencimiento; // 'YYYY-MM-DD' o null
    const limite = vence ? Date.parse(`${vence}T23:59:59-05:00`) : Infinity;
    let restante = info.enRiesgo;
    let evitadasLote = 0;
    const propias = salidas
      .filter((s) => Number(s.lote_id) === loteId)
      .map((s) => ({ ...s, t: new Date(s.fecha).getTime() }))
      .filter((s) => s.t >= info.desde && s.t <= limite)
      .sort((a, b) => a.t - b.t);
    for (const salida of propias) {
      if (restante <= 0) break;
      const toma = Math.min(restante, Number(salida.cantidad));
      restante -= toma;
      evitadasLote += toma;
      unidades += toma;
      valor += toma * Number(salida.precio_unitario || 0);
    }
    if (evitadasLote > 0) lotesConMerma += 1;
  }

  return {
    unidades: redondear(unidades),
    valor: redondear(valor),
    lotes: lotesConMerma,
    alertas: alertasConsideradas,
  };
}

// ---------- TC-02 / TC-07: suficiencia de datos ----------

function evaluarSuficiencia({ periodo, primerDato, diasConVentas, rotacion }) {
  const razones = [];
  let historialOk = true;

  if (!primerDato || primerDato > periodo.hasta) {
    razones.push('El sistema aún no tiene historial para este periodo.');
    historialOk = false;
  } else {
    const cubierto = diasEntre(primerDato > periodo.desde ? primerDato : periodo.desde, periodo.hasta) + 1;
    const cobertura = cubierto / periodo.dias;
    if (cobertura < MIN_COBERTURA) {
      razones.push(`El historial cubre solo el ${Math.round(cobertura * 100)}% del periodo (mínimo ${MIN_COBERTURA * 100}%).`);
      historialOk = false;
    }
  }
  if (diasConVentas < MIN_DIAS_CON_VENTAS) {
    razones.push(`Hay ${diasConVentas} día(s) con ventas en el periodo (mínimo ${MIN_DIAS_CON_VENTAS}).`);
  }
  if (!rotacion.calculable) {
    razones.push('No hay inventario promedio o ventas suficientes para calcular la rotación.');
  }

  return { suficiente: razones.length === 0, historialOk, razones };
}

module.exports = {
  ErrorPeriodo,
  MAX_DIAS_PERIODO,
  MIN_COBERTURA,
  MIN_DIAS_CON_VENTAS,
  PERIODOS_VALIDOS,
  calcularMermasEvitadas,
  calcularRotacion,
  evaluarSuficiencia,
  hoyEnPeru,
  puntosDeMuestreo,
  resolverPeriodo,
  sumarDias,
};
