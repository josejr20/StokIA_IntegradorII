'use strict';

/**
 * US-32 (HU-166 / TC-02, TC-07) — Tarea programada que reintenta los correos de alertas críticas
 * que fallaron (por ejemplo, porque el SMTP no estaba disponible).
 *
 * Cada pasada procesa solo los envíos cuyo `proximo_reintento` ya venció; la espera entre
 * intentos crece (5, 10, 20, 40 y 60 min) y se detiene al llegar a NOTIFICACIONES_MAX_INTENTOS.
 */

const cron = require('node-cron');
const config = require('../config');
const logger = require('../utils/logger');

/** Ejecuta una pasada de reintentos; nunca lanza (un error no debe tumbar la tarea programada). */
async function ejecutarReintentos({
  procesar = () => require('./notificacionCriticaService').procesarReintentos(),
  log = logger,
} = {}) {
  try {
    return await procesar();
  } catch (error) {
    log.error(`[US-32] Error en el reintento de notificaciones: ${error.message}`);
    return null;
  }
}

/**
 * Programa el worker. Evita que dos pasadas se solapen dentro del proceso
 * (entre procesos lo protege la reserva atómica del repositorio).
 */
function iniciarNotificacionesCron({
  expresion = config.NOTIFICACIONES_CRON_EXPRESION,
  procesar,
  log = logger,
} = {}) {
  if (!cron.validate(expresion)) {
    throw new Error(`NOTIFICACIONES_CRON_EXPRESION no es una expresión cron válida: ${expresion}`);
  }
  let enCurso = false;
  return cron.schedule(
    expresion,
    async () => {
      if (enCurso) return;
      enCurso = true;
      try {
        await ejecutarReintentos({ procesar, log });
      } finally {
        enCurso = false;
      }
    },
    { timezone: 'America/Lima' },
  );
}

module.exports = { ejecutarReintentos, iniciarNotificacionesCron };
