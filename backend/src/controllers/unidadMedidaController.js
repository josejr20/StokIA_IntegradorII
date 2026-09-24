const { validationResult } = require('express-validator');
const { UnidadMedida } = require('../models');
const { UnidadMedidaDto } = require('../dtos/unidadMedidaDto');
const logger = require('../utils/logger');

const listar = async (req, res, next) => {
  try { const unidades = await UnidadMedida.findAll(); res.json({ data: unidades.map(u => UnidadMedidaDto.fromModel(u)) }); }
  catch (error) { next(error); }
};
const obtener = async (req, res, next) => {
  try { const unidad = await UnidadMedida.findByPk(req.params.id); if (!unidad) return res.status(404).json({ error: 'Unidad no encontrada' }); res.json({ data: UnidadMedidaDto.fromModel(unidad) }); }
  catch (error) { next(error); }
};
const crear = async (req, res, next) => {
  try {
    const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ error: 'Datos inválidos', details: errors.array() });
    const data = UnidadMedidaDto.fromCreate(req.body); const unidad = await UnidadMedida.create(data);
    res.status(201).json({ data: UnidadMedidaDto.fromModel(unidad) });
  } catch (error) { next(error); }
};
const actualizar = async (req, res, next) => {
  try { const unidad = await UnidadMedida.findByPk(req.params.id); if (!unidad) return res.status(404).json({ error: 'Unidad no encontrada' }); const data = UnidadMedidaDto.fromUpdate(req.body); await unidad.update(data); res.json({ data: UnidadMedidaDto.fromModel(unidad) }); }
  catch (error) { next(error); }
};
const eliminar = async (req, res, next) => {
  try { const unidad = await UnidadMedida.findByPk(req.params.id); if (!unidad) return res.status(404).json({ error: 'Unidad no encontrada' }); await unidad.destroy(); res.json({ message: 'Unidad eliminada' }); }
  catch (error) { next(error); }
};
module.exports = { listar, obtener, crear, actualizar, eliminar };
