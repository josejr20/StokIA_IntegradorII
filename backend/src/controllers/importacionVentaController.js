const { validationResult } = require('express-validator');
const { ImportacionVenta } = require('../models');
const { ImportacionVentaDto } = require('../dtos/importacionVentaDto');
const logger = require('../utils/logger');

const listar = async (req, res, next) => {
  try {
    const importaciones = await ImportacionVenta.findAll({ order: [['fecha', 'DESC']] });
    res.json({ data: importaciones.map(i => ImportacionVentaDto.fromModel(i)) });
  } catch (error) { next(error); }
};
const obtener = async (req, res, next) => {
  try { const importacion = await ImportacionVenta.findByPk(req.params.id); if (!importacion) return res.status(404).json({ error: 'Importación no encontrada' }); res.json({ data: ImportacionVentaDto.fromModel(importacion) }); }
  catch (error) { next(error); }
};
module.exports = { listar, obtener };
