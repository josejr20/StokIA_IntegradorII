'use strict';

const servicio = require('../services/mlModeloService');

function responderError(error, res, next) {
  if (error instanceof servicio.ErrorML) {
    return res.status(error.estadoHttp).json({ error: error.message, codigo: error.codigo });
  }
  return next(error);
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
    res.status(201).json({ data: await servicio.entrenarModelo() });
  } catch (error) {
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

module.exports = { listar, entrenar, activar, evaluar, leerId };
