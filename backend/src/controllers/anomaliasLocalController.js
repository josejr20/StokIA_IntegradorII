'use strict';

const { evaluarAnomalias } = require('../services/anomaliasRegistroService');

function opcionesDesde(objeto) {
  const diasHistorial = objeto?.diasHistorial === undefined ? 180 : Number(objeto.diasHistorial);
  const limiteNuevas = objeto?.limiteNuevas === undefined ? 50 : Number(objeto.limiteNuevas);
  return { diasHistorial, limiteNuevas };
}

function manejarError(error, res, next) {
  if (error instanceof RangeError || error instanceof TypeError) {
    return res.status(400).json({ mensaje: error.message });
  }
  if (error.codigo === 'HISTORIAL_DEMASIADO_GRANDE') {
    return res.status(422).json({ mensaje: error.message });
  }
  return next(error);
}

async function vistaPrevia(req, res, next) {
  try {
    const resultado = await evaluarAnomalias({ ...opcionesDesde(req.query), guardar: false });
    return res.json(resultado);
  } catch (error) {
    return manejarError(error, res, next);
  }
}

async function registrar(req, res, next) {
  // Evita cambios involuntarios: una consulta GET nunca guarda datos.
  if (req.body?.confirmar !== true) {
    return res.status(400).json({ mensaje: 'Para registrar alertas, envie confirmar: true.' });
  }
  try {
    const resultado = await evaluarAnomalias({ ...opcionesDesde(req.body), guardar: true });
    return res.json(resultado);
  } catch (error) {
    return manejarError(error, res, next);
  }
}

module.exports = { vistaPrevia, registrar };
