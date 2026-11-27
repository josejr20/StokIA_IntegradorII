'use strict';

const { obtenerKpisGenerales } = require('../services/kpiGeneralesService');

/**
 * GET /api/reportes/kpis/generales?periodo=90d|mes_actual|...&desde=&hasta=
 * US-34: rotación de inventario y mermas evitadas del periodo elegido.
 */
const kpisGenerales = async (req, res, next) => {
  try {
    const { periodo, desde, hasta } = req.query;
    res.json({ data: await obtenerKpisGenerales({ periodo, desde, hasta }) });
  } catch (error) {
    if (error.name === 'ErrorPeriodo') return res.status(400).json({ error: error.message });
    next(error);
  }
};

module.exports = { kpisGenerales };
