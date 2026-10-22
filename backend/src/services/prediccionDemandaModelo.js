'use strict';

/**
 * HU-72 · ML-01 — Modelo de predicción de demanda.
 *
 * Módulo puro (sin base de datos ni dependencias): recibe las ventas de UN producto
 * y devuelve la estimación de demanda. Así se puede probar con datos simulados.
 *
 * Modelo: suavizado exponencial de Holt amortiguado con estacionalidad semanal.
 *  1. Serie diaria de ventas (días sin venta = 0) hasta el último día completo.
 *  2. Factores por día de la semana (se usan solo con >= 4 semanas de historial).
 *  3. Nivel y tendencia se actualizan día a día sobre la serie sin estacionalidad.
 *  4. Se proyecta cada día del horizonte y se multiplica por su factor semanal.
 *  5. El intervalo (80 %) sale del error que el propio modelo cometió sobre el historial,
 *     más la incertidumbre del nivel estimado.
 *
 * Los días se agrupan en hora de Lima (UTC-5, sin horario de verano).
 */

const MS_DIA = 24 * 60 * 60 * 1000;
const OFFSET_LIMA_MS = -5 * 60 * 60 * 1000;
const FACTOR_MINIMO = 0.05;

const CONFIG = Object.freeze({
  VENTANA_DIAS: 84, // se analizan como máximo las últimas 12 semanas
  MIN_DIAS_HISTORIAL: 14, // "historial suficiente": al menos 2 semanas...
  MIN_DIAS_CON_VENTAS: 7, // ...y al menos 7 días con ventas dentro de ellas
  MIN_DIAS_ESTACIONALIDAD: 28,
  // Las ventas diarias son muy ruidosas: se suaviza fuerte (valores validados con una prueba
  // hacia atrás sobre ventas simuladas). Conviene reajustarlos cuando haya ventas reales.
  ALPHA: 0.1,
  BETA: 0.01,
  PHI: 0.9,
  Z_INTERVALO_80: 1.2816,
  HORIZONTE_MIN: 1,
  HORIZONTE_MAX: 30,
  HORIZONTE_DEFECTO: 7,
  DIAS_SERIE_MOSTRADA: 42,
});

const NOMBRE_MODELO = 'Holt amortiguado con estacionalidad semanal';
const VERSION_MODELO = '1.0.0';

// ---------------------------------------------------------------- fechas (YYYY-MM-DD)

const redondear = (valor, decimales = 2) => {
  const factor = 10 ** decimales;
  return Math.round((valor + Number.EPSILON) * factor) / factor;
};

const aUtc = (iso) => {
  const [anio, mes, dia] = iso.split('-').map(Number);
  return Date.UTC(anio, mes - 1, dia);
};

const fechaLima = (fecha) => new Date(fecha.getTime() + OFFSET_LIMA_MS).toISOString().slice(0, 10);
const sumarDias = (iso, dias) => new Date(aUtc(iso) + dias * MS_DIA).toISOString().slice(0, 10);
const diaSemana = (iso) => new Date(aUtc(iso)).getUTCDay();
const diferenciaDias = (isoA, isoB) => Math.round((aUtc(isoB) - aUtc(isoA)) / MS_DIA);

/** Último día completo (ayer, hora de Lima): el día en curso todavía no terminó. */
const ultimoDiaCompleto = (ahora = new Date()) => sumarDias(fechaLima(ahora), -1);

/** Rango de fechas UTC que hay que consultar en la base: [desde, hasta). */
function rangoConsultaUtc(hasta, ventanaDias = CONFIG.VENTANA_DIAS) {
  const desdeIso = sumarDias(hasta, -(ventanaDias - 1));
  return {
    desde: new Date(Date.parse(`${desdeIso}T00:00:00-05:00`)),
    hasta: new Date(Date.parse(`${hasta}T00:00:00-05:00`) + MS_DIA),
  };
}

// ---------------------------------------------------------------- parámetros

/** Valida el horizonte (en días) que pide el usuario. Lanza RangeError si no es válido. */
function validarHorizonte(valor) {
  if (valor === undefined || valor === null || valor === '') return CONFIG.HORIZONTE_DEFECTO;
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < CONFIG.HORIZONTE_MIN || numero > CONFIG.HORIZONTE_MAX) {
    throw new RangeError(
      `El horizonte debe ser un número entero de días entre ${CONFIG.HORIZONTE_MIN} y ${CONFIG.HORIZONTE_MAX}`,
    );
  }
  return numero;
}

/** Versión tolerante (para llamadas internas): corrige en vez de lanzar error. */
function normalizarHorizonte(valor) {
  const numero = Math.trunc(Number(valor));
  if (!Number.isFinite(numero)) return CONFIG.HORIZONTE_DEFECTO;
  return Math.min(CONFIG.HORIZONTE_MAX, Math.max(CONFIG.HORIZONTE_MIN, numero));
}

// ---------------------------------------------------------------- serie diaria

/**
 * ventas: [{ fecha_venta, cantidad }]. Devuelve la serie diaria contigua desde la primera
 * venta (dentro de la ventana) hasta `hasta`, con 0 en los días sin ventas.
 */
function construirSerie(ventas, hasta, ventanaDias = CONFIG.VENTANA_DIAS) {
  const limiteInferior = sumarDias(hasta, -(ventanaDias - 1));
  const porDia = new Map();

  for (const venta of ventas) {
    const fecha = new Date(venta.fecha_venta);
    const cantidad = Number(venta.cantidad);
    if (Number.isNaN(fecha.getTime()) || !Number.isFinite(cantidad)) continue;
    const dia = fechaLima(fecha);
    if (dia < limiteInferior || dia > hasta) continue;
    porDia.set(dia, (porDia.get(dia) ?? 0) + cantidad);
  }

  const diasConVentas = [...porDia.values()].filter((cantidad) => cantidad > 0).length;
  if (porDia.size === 0) return { serie: [], diasConVentas: 0, unidades: 0, desde: null };

  const desde = [...porDia.keys()].sort()[0];
  const total = diferenciaDias(desde, hasta) + 1;
  const serie = [];
  let unidades = 0;
  for (let i = 0; i < total; i += 1) {
    const fecha = sumarDias(desde, i);
    const cantidad = Math.max(0, porDia.get(fecha) ?? 0);
    unidades += cantidad;
    serie.push({ fecha, cantidad });
  }
  return { serie, diasConVentas, unidades, desde };
}

/** HU-72 TC-02 / TC-07: ¿hay historial suficiente para predecir? */
function evaluarSuficiencia({ serie, diasConVentas }) {
  if (serie.length === 0 || diasConVentas === 0) return { suficiente: false, motivo: 'sin_ventas' };
  if (diasConVentas < CONFIG.MIN_DIAS_CON_VENTAS) return { suficiente: false, motivo: 'pocos_dias_con_ventas' };
  if (serie.length < CONFIG.MIN_DIAS_HISTORIAL) return { suficiente: false, motivo: 'historial_corto' };
  return { suficiente: true, motivo: null };
}

function mensajeInsuficiencia(motivo, { serie, diasConVentas }) {
  const { MIN_DIAS_CON_VENTAS, MIN_DIAS_HISTORIAL, VENTANA_DIAS } = CONFIG;
  if (motivo === 'sin_ventas') {
    return `No hay ventas registradas de este producto en los últimos ${VENTANA_DIAS} días, por lo que no hay datos suficientes para predecir.`;
  }
  if (motivo === 'pocos_dias_con_ventas') {
    return `No hay datos suficientes para predecir: el producto tiene ${diasConVentas} día(s) con ventas y se necesitan al menos ${MIN_DIAS_CON_VENTAS}.`;
  }
  return `No hay datos suficientes para predecir: el historial abarca ${serie.length} día(s) y se necesitan al menos ${MIN_DIAS_HISTORIAL}.`;
}

// ---------------------------------------------------------------- modelo

/** Factores por día de la semana (índice 0 = domingo). Neutros si hay poco historial. */
function calcularFactoresSemanales(serie) {
  const neutros = [1, 1, 1, 1, 1, 1, 1];
  if (serie.length < CONFIG.MIN_DIAS_ESTACIONALIDAD) return neutros;

  const suma = Array(7).fill(0);
  const cuenta = Array(7).fill(0);
  for (const { fecha, cantidad } of serie) {
    const dia = diaSemana(fecha);
    suma[dia] += cantidad;
    cuenta[dia] += 1;
  }
  const medias = suma.map((total, i) => (cuenta[i] ? total / cuenta[i] : 0));
  const mediaGlobal = medias.reduce((a, b) => a + b, 0) / 7;
  if (mediaGlobal <= 0) return neutros;

  // Con pocas semanas el patrón es ruidoso: se mezcla gradualmente con el factor neutro.
  const peso = Math.min(1, Math.floor(serie.length / 7) / 8);
  return medias.map((media) => 1 + peso * (media / mediaGlobal - 1));
}

/** Recorre el historial actualizando nivel y tendencia; mide el error de cada paso. */
function ajustarModelo(serie, factores) {
  const n = serie.length;
  const sinEstacion = (i) => {
    const factor = factores[diaSemana(serie[i].fecha)];
    return factor > FACTOR_MINIMO ? serie[i].cantidad / factor : null;
  };
  const media = (desde, hasta) => {
    let suma = 0;
    let cuenta = 0;
    for (let i = desde; i < hasta; i += 1) {
      const valor = sinEstacion(i);
      if (valor !== null) {
        suma += valor;
        cuenta += 1;
      }
    }
    return cuenta ? suma / cuenta : 0;
  };

  const { ALPHA, BETA, PHI } = CONFIG;
  let nivel = media(0, 7);
  let tendencia = n >= 14 ? (media(7, 14) - media(0, 7)) / 7 : 0;

  let sumaCuadrados = 0;
  let sumaAbsolutos = 0;
  let sumaReales = 0;
  let pasos = 0;

  for (let t = 7; t < n; t += 1) {
    const factor = factores[diaSemana(serie[t].fecha)];
    const base = nivel + PHI * tendencia;
    const ajustado = Math.max(0, base) * factor;
    const real = serie[t].cantidad;
    const error = real - ajustado;
    sumaCuadrados += error * error;
    sumaAbsolutos += Math.abs(error);
    sumaReales += real;
    pasos += 1;

    const observado = sinEstacion(t);
    if (observado === null) {
      nivel = base;
      tendencia = PHI * tendencia;
    } else {
      const nivelNuevo = ALPHA * observado + (1 - ALPHA) * base;
      tendencia = BETA * (nivelNuevo - nivel) + (1 - BETA) * PHI * tendencia;
      nivel = nivelNuevo;
    }
  }

  return {
    nivel,
    tendencia,
    sigma: pasos ? Math.sqrt(sumaCuadrados / pasos) : 0,
    errorRelativo: sumaReales > 0 ? sumaAbsolutos / sumaReales : null,
  };
}

function proyectar({ nivel, tendencia }, factores, hasta, horizonte) {
  const dias = [];
  let potencia = 1;
  let efectoTendencia = 0;
  for (let h = 1; h <= horizonte; h += 1) {
    potencia *= CONFIG.PHI;
    efectoTendencia += potencia * tendencia;
    const fecha = sumarDias(hasta, h);
    dias.push({ fecha, cantidad: Math.max(0, nivel + efectoTendencia) * factores[diaSemana(fecha)] });
  }
  return dias;
}

function clasificarTendencia(serie) {
  const n = serie.length;
  const bloque = n >= 28 ? 14 : 7;
  const suma = (desde, hasta) => serie.slice(desde, hasta).reduce((total, punto) => total + punto.cantidad, 0);
  const reciente = suma(n - bloque, n);
  const previo = suma(n - 2 * bloque, n - bloque);
  if (previo === 0) return reciente > 0 ? 'sube' : 'estable';
  const razon = reciente / previo;
  if (razon >= 1.1) return 'sube';
  if (razon <= 0.9) return 'baja';
  return 'estable';
}

function clasificarConfianza(errorRelativo) {
  if (errorRelativo === null) return 'baja';
  if (errorRelativo < 0.3) return 'alta';
  if (errorRelativo < 0.6) return 'media';
  return 'baja';
}

const formatoNumero = (valor) => valor.toLocaleString('es-PE', { maximumFractionDigits: 1 });

/**
 * Punto de entrada: ventas de un producto -> resultado listo para la API.
 * `hasta` es el último día completo (YYYY-MM-DD).
 */
function predecirDemanda(ventas, { horizonte = CONFIG.HORIZONTE_DEFECTO, hasta = ultimoDiaCompleto() } = {}) {
  const info = construirSerie(ventas, hasta);
  const historial = {
    desde: info.desde,
    hasta: info.serie.length ? hasta : null,
    dias_analizados: info.serie.length,
    dias_con_ventas: info.diasConVentas,
    unidades: redondear(info.unidades),
  };
  const serieHistorica = info.serie
    .slice(-CONFIG.DIAS_SERIE_MOSTRADA)
    .map((punto) => ({ fecha: punto.fecha, cantidad: redondear(punto.cantidad) }));

  const suficiencia = evaluarSuficiencia(info);
  if (!suficiencia.suficiente) {
    return {
      estado: 'datos_insuficientes',
      horizonte_dias: horizonte,
      motivo: suficiencia.motivo,
      mensaje: mensajeInsuficiencia(suficiencia.motivo, info),
      historial,
      requisitos: {
        min_dias_con_ventas: CONFIG.MIN_DIAS_CON_VENTAS,
        min_dias_historial: CONFIG.MIN_DIAS_HISTORIAL,
      },
      serie_historica: serieHistorica,
    };
  }

  const factores = calcularFactoresSemanales(info.serie);
  const ajuste = ajustarModelo(info.serie, factores);
  const dias = proyectar(ajuste, factores, hasta, horizonte);

  const total = dias.reduce((suma, dia) => suma + dia.cantidad, 0);
  // Varianza del total = ruido diario (H · σ²) + incertidumbre del nivel estimado (H² · σ² · α/(2-α)),
  // que no se promedia a lo largo del horizonte porque afecta a todos los días por igual.
  const varianzaRelativa = horizonte + horizonte ** 2 * (CONFIG.ALPHA / (2 - CONFIG.ALPHA));
  const margen = CONFIG.Z_INTERVALO_80 * ajuste.sigma * Math.sqrt(varianzaRelativa);
  const inferior = Math.max(0, total - margen);
  const superior = total + margen;
  const periodo = horizonte === 1 ? 'el próximo día' : `los próximos ${horizonte} días`;

  return {
    estado: 'ok',
    horizonte_dias: horizonte,
    demanda_estimada: redondear(total),
    intervalo_inferior: redondear(inferior),
    intervalo_superior: redondear(superior),
    nivel_intervalo: 80,
    promedio_diario: redondear(total / horizonte),
    tendencia: clasificarTendencia(info.serie),
    confianza: clasificarConfianza(ajuste.errorRelativo),
    error_relativo: ajuste.errorRelativo === null ? null : redondear(ajuste.errorRelativo, 3),
    mensaje:
      `Se estima una demanda de ${formatoNumero(total)} unidades para ${periodo}, ` +
      `con un rango probable entre ${formatoNumero(inferior)} y ${formatoNumero(superior)}.`,
    historial,
    serie_historica: serieHistorica,
    proyeccion: dias.map((dia) => ({ fecha: dia.fecha, cantidad: redondear(dia.cantidad) })),
    modelo: { nombre: NOMBRE_MODELO, version: VERSION_MODELO },
  };
}

module.exports = {
  CONFIG,
  NOMBRE_MODELO,
  VERSION_MODELO,
  predecirDemanda,
  construirSerie,
  evaluarSuficiencia,
  calcularFactoresSemanales,
  validarHorizonte,
  normalizarHorizonte,
  ultimoDiaCompleto,
  rangoConsultaUtc,
  fechaLima,
  sumarDias,
  diaSemana,
};
