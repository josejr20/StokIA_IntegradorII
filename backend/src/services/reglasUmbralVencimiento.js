'use strict';

/**
 * HU-118 (US-23) · Reglas puras del umbral de días para la alerta de vencimiento.
 *
 * Módulo sin base de datos ni dependencias: valida el valor que escribe el administrador
 * y decide, para un lote, si está en riesgo según el umbral que le corresponde.
 *
 * Jerarquía del umbral (de más a menos específico):
 *   1. umbral de la categoría del producto  (TC-06)
 *   2. umbral general configurado por el administrador
 *   3. valor predeterminado (30 días, el que el sistema ya usaba antes de esta historia)
 */

const DIAS_PREDETERMINADO = 30;
const DIAS_MAXIMO = 3650; // 10 años: evita valores absurdos que dejarían todo "en riesgo"

class ErrorUmbralVencimiento extends Error {
  constructor(mensaje, status = 400) {
    super(mensaje);
    this.name = 'ErrorUmbralVencimiento';
    this.status = status;
  }
}

/**
 * TC-02 / TC-05: el valor debe ser numérico, entero y positivo.
 * Acepta número (30) o texto numérico ("30"); rechaza negativos, cero, decimales,
 * notación científica, vacío, null, booleanos y texto.
 * Devuelve el entero validado o lanza ErrorUmbralVencimiento.
 */
function validarDiasVencimiento(valor) {
  if (typeof valor !== 'number' && typeof valor !== 'string') {
    throw new ErrorUmbralVencimiento('El umbral de días debe ser un número entero positivo.');
  }
  const texto = String(valor).trim();
  if (texto === '') {
    throw new ErrorUmbralVencimiento('Ingrese el número de días de anticipación.');
  }
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(texto)) {
    throw new ErrorUmbralVencimiento('El umbral de días debe ser un valor numérico.');
  }
  const numero = Number(texto);
  if (numero <= 0) {
    throw new ErrorUmbralVencimiento('El umbral de días debe ser mayor a cero (no se permiten negativos).');
  }
  if (!Number.isInteger(numero)) {
    throw new ErrorUmbralVencimiento('El umbral de días debe ser un número entero.');
  }
  if (numero > DIAS_MAXIMO) {
    throw new ErrorUmbralVencimiento(`El umbral de días no puede superar ${DIAS_MAXIMO}.`);
  }
  return numero;
}

/** Versión que no lanza: devuelve null si el valor guardado no es válido (dato corrupto). */
function diasValidosONull(valor) {
  try { return validarDiasVencimiento(valor); } catch { return null; }
}

/**
 * Umbral que aplica a una categoría.
 * `config` = { global: number|null, porCategoria: Map<number, number> }
 * Devuelve { dias, origen } con origen 'categoria' | 'global' | 'predeterminado'.
 */
function resolverUmbral(categoriaId, config = {}) {
  const porCategoria = config.porCategoria instanceof Map ? config.porCategoria : new Map();
  if (categoriaId !== null && categoriaId !== undefined && porCategoria.has(Number(categoriaId))) {
    return { dias: porCategoria.get(Number(categoriaId)), origen: 'categoria' };
  }
  if (Number.isInteger(config.global) && config.global > 0) {
    return { dias: config.global, origen: 'global' };
  }
  return { dias: DIAS_PREDETERMINADO, origen: 'predeterminado' };
}

/** Severidad según qué tan cerca del vencimiento está el lote respecto de su umbral. */
function severidadPorCercania(diasRestantes, umbral) {
  if (diasRestantes < 0) return 'critica';
  const proporcion = diasRestantes / umbral;
  if (proporcion <= 0.25) return 'alta';
  if (proporcion <= 0.6) return 'media';
  return 'baja';
}

/**
 * TC-04: clasifica un lote con el umbral dado.
 *  - 'vencido'   : ya pasó su fecha de vencimiento.
 *  - 'en_riesgo' : vence dentro del umbral (días restantes <= umbral).
 *  - 'vigente'   : vence después del umbral, o no tiene fecha de vencimiento.
 */
function evaluarLote(diasRestantes, umbral) {
  if (diasRestantes === null || diasRestantes === undefined) {
    return { estado: 'vigente', en_riesgo: false, severidad: null };
  }
  if (diasRestantes < 0) {
    return { estado: 'vencido', en_riesgo: true, severidad: 'critica' };
  }
  if (diasRestantes <= umbral) {
    return { estado: 'en_riesgo', en_riesgo: true, severidad: severidadPorCercania(diasRestantes, umbral) };
  }
  return { estado: 'vigente', en_riesgo: false, severidad: null };
}

module.exports = {
  DIAS_PREDETERMINADO,
  DIAS_MAXIMO,
  ErrorUmbralVencimiento,
  validarDiasVencimiento,
  diasValidosONull,
  resolverUmbral,
  severidadPorCercania,
  evaluarLote,
};
