const { validationResult } = require('express-validator');
const { UmbralConfiguracion } = require('../models');
const { UmbralDto } = require('../dtos/umbralDto');
const logger = require('../utils/logger');

const listar = async (req, res, next) => {
  try {
    const umbrales = await UmbralConfiguracion.findAll({ include: [{ model: UmbralConfiguracion.sequelize.models.Producto, as: 'producto' }] });
    res.json({ data: umbrales.map(u => UmbralDto.fromModel(u)) });
  } catch (error) { next(error); }
};
const obtener = async (req, res, next) => {
  try { const umbral = await UmbralConfiguracion.findByPk(req.params.id); if (!umbral) return res.status(404).json({ error: 'Umbral no encontrado' }); res.json({ data: UmbralDto.fromModel(umbral) }); }
  catch (error) { next(error); }
};
const crear = async (req, res, next) => {
  try {
    const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ error: 'Datos inválidos', details: errors.array() });
    const data = UmbralDto.fromCreate(req.body); const umbral = await UmbralConfiguracion.create(data);
    res.status(201).json({ data: UmbralDto.fromModel(umbral) });
  } catch (error) { next(error); }
};
const actualizar = async (req, res, next) => {
  try { const umbral = await UmbralConfiguracion.findByPk(req.params.id); if (!umbral) return res.status(404).json({ error: 'Umbral no encontrado' }); const data = UmbralDto.fromUpdate(req.body); await umbral.update(data); res.json({ data: UmbralDto.fromModel(umbral) }); }
  catch (error) { next(error); }
};
const eliminar = async (req, res, next) => {
  try { const umbral = await UmbralConfiguracion.findByPk(req.params.id); if (!umbral) return res.status(404).json({ error: 'Umbral no encontrado' }); await umbral.destroy(); res.json({ message: 'Umbral eliminado' }); }
  catch (error) { next(error); }
};
module.exports = { listar, obtener, crear, actualizar, eliminar };
