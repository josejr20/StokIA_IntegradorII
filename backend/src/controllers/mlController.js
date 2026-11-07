'use strict';

const servicio = require('../services/mlModeloService');

function responderError(error, res, next) {
  if (error instanceof servicio.ErrorML) {
    // `detalle` (si existe) explica con números el motivo, por ejemplo cuántas filas válidas faltan para entrenar.
    const cuerpo = { error: error.message, codigo: error.codigo };
    if (error.detalle) cuerpo.detalle = error.detalle;
    return res.status(error.estadoHttp).json(cuerpo);
  }
  return next(error);
}

/**
 * HU-82: deja constancia en la auditoría de quién entrenó el modelo y con qué resultado.
 * Es un registro auxiliar: si falla, no afecta la respuesta del entrenamiento.
 */
async function auditarEntrenamiento(req, accion, modeloId, detalle) {
  try {
    const { crearAuditoria } = require('../middleware/auditoria');
    await crearAuditoria(req.user?.id, accion, 'ml_modelos', modeloId, detalle);
  } catch {
    // se ignora a propósito
  }
}

const listar = async (req, res, next) => {
  try {
    res.json({ data: await servicio.listar() });
  } catch (error) {
    responderError(error, res, next);
  }
};

const entrenar = async (req, res, next) => {
  try {
    const resultado = await servicio.entrenarModelo({ disparadoPor: 'manual' });
    await auditarEntrenamiento(req, 'entrenar_modelo_ml', resultado.modelo?.id ?? null, {
      version: resultado.modelo?.version,
      activado: resultado.activado,
      duracion_ms: resultado.entrenamiento?.duracion_ms,
      rmse_relativo: resultado.modelo?.rmse_relativo,
    });
    res.status(201).json({ data: resultado });
  } catch (error) {
    if (error instanceof servicio.ErrorML && error.codigo === 'datos_insuficientes') {
      await auditarEntrenamiento(req, 'entrenar_modelo_ml_sin_datos', null, error.detalle);
    }
    responderError(error, res, next);
  }
};

/** Valida el :id de la URL (entero positivo). */
function leerId(params = {}) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

const activar = async (req, res, next) => {
  try {
    const id = leerId(req.params);
    if (id === null) return res.status(400).json({ error: 'El identificador de la versión no es válido' });
    return res.json({ data: await servicio.activarVersion(id) });
  } catch (error) {
    return responderError(error, res, next);
  }
};

const evaluar = async (req, res, next) => {
  try {
    res.json({ data: await servicio.evaluarModeloActivo() });
  } catch (error) {
    responderError(error, res, next);
  }
};

/** HU-88: métricas (MAE, RMSE) de todas las versiones, con su comparación contra la anterior e historial. */
const metricas = async (req, res, next) => {
  try {
    res.json({ data: await servicio.obtenerMetricas() });
  } catch (error) {
    responderError(error, res, next);
  }
};

/** HU-88 / TC-05: compara dos versiones elegidas (?base=<id>&nueva=<id>). */
const comparar = async (req, res, next) => {
  try {
    const base = leerId({ id: req.query.base });
    const nueva = leerId({ id: req.query.nueva });
    if (base === null || nueva === null) return res.status(400).json({ error: 'Indica dos versiones válidas para comparar (base y nueva).' });
    return res.json({ data: await servicio.compararVersiones(base, nueva) });
  } catch (error) {
    return responderError(error, res, next);
  }
};

module.exports = { listar, entrenar, activar, evaluar, metricas, comparar, leerId };
