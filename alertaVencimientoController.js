'use strict';

const servicio = require('../services/alertaVencimientoService');

/**
 * GET /api/alertas/vencimiento
 * Alertas activas de riesgo alto para el dashboard (US-29), ya recalculadas.
 */
const listar = async (req, res, next) => {
  try {
    const data = await servicio.refrescarYListar({ usuarioId: req.user.id });
    res.json({ data });
  } catch (error) {
    next(error);
  }
};

module.exports = { listar };
