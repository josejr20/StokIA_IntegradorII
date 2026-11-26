'use strict';

/**
 * US-32 — Endpoints de la notificación de alertas críticas por correo.
 *  GET  /api/notificaciones/configuracion  → roles que reciben cada tipo de alerta (HU-165)
 *  PUT  /api/notificaciones/configuracion  → guarda esos roles (HU-165)
 *  GET  /api/notificaciones/historial      → historial de correos enviados/fallidos (HU-166)
 *  POST /api/notificaciones/reintentos     → fuerza el reintento de los envíos fallidos (HU-166)
 */

const servicio = require('../services/notificacionCriticaService');

/** Los errores de validación del servicio llevan su propio código HTTP; el resto va al errorHandler. */
function responderError(res, next, error) {
  if (error instanceof servicio.ErrorNotificacion) {
    return res.status(error.status).json({ error: error.message });
  }
  return next(error);
}

const obtenerConfiguracion = async (req, res, next) => {
  try {
    res.json(await servicio.obtenerConfiguracion());
  } catch (error) { responderError(res, next, error); }
};

const guardarConfiguracion = async (req, res, next) => {
  try {
    const configuracion = await servicio.guardarConfiguracion(req.body?.destinatarios);
    res.json({ ...configuracion, message: 'Destinatarios de alertas críticas actualizados.' });
  } catch (error) { responderError(res, next, error); }
};

const historial = async (req, res, next) => {
  try {
    res.json(await servicio.obtenerHistorial(req.query));
  } catch (error) { responderError(res, next, error); }
};

const reintentar = async (req, res, next) => {
  try {
    const data = await servicio.procesarReintentos();
    res.json({ data, message: 'Reintentos de notificación procesados.' });
  } catch (error) { responderError(res, next, error); }
};

module.exports = { obtenerConfiguracion, guardarConfiguracion, historial, reintentar };
