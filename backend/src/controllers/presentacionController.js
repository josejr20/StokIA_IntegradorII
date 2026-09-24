const { validationResult } = require('express-validator');
const { Presentacion } = require('../models');
const { PresentacionDto } = require('../dtos/presentacionDto');
const logger = require('../utils/logger');

const listar = async (req, res, next) => {
  try { const presentaciones = await Presentacion.findAll(); res.json({ data: presentaciones.map(p => PresentacionDto.fromModel(p)) }); }
  catch (error) { next(error); }
};
const obtener = async (req, res, next) => {
  try { const presentacion = await Presentacion.findByPk(req.params.id); if (!presentacion) return res.status(404).json({ error: 'Presentación no encontrada' }); res.json({ data: PresentacionDto.fromModel(presentacion) }); }
  catch (error) { next(error); }
};
const crear = async (req, res, next) => {
  try {
    const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ error: 'Datos inválidos', details: errors.array() });
    const data = PresentacionDto.fromCreate(req.body); const presentacion = await Presentacion.create(data);
    res.status(201).json({ data: PresentacionDto.fromModel(presentacion) });
  } catch (error) { next(error); }
};
const actualizar = async (req, res, next) => {
  try { const presentacion = await Presentacion.findByPk(req.params.id); if (!presentacion) return res.status(404).json({ error: 'Presentación no encontrada' }); const data = PresentacionDto.fromUpdate(req.body); await presentacion.update(data); res.json({ data: PresentacionDto.fromModel(presentacion) }); }
  catch (error) { next(error); }
};
const eliminar = async (req, res, next) => {
  try { const presentacion = await Presentacion.findByPk(req.params.id); if (!presentacion) return res.status(404).json({ error: 'Presentación no encontrada' }); await presentacion.destroy(); res.json({ message: 'Presentación eliminada' }); }
  catch (error) { next(error); }
};
module.exports = { listar, obtener, crear, actualizar, eliminar };
