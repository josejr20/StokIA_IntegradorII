const { validationResult } = require('express-validator');
const { CatalogoValor } = require('../models');
const { CatalogoValorDto } = require('../dtos/catalogoValorDto');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

const listar = async (req, res, next) => {
  try {
    const valores = await CatalogoValor.findAll({ where: req.query.tipo ? { tipo: req.query.tipo } : undefined });
    res.json({ data: valores.map(v => CatalogoValorDto.fromModel(v)) });
  } catch (error) { next(error); }
};
const obtener = async (req, res, next) => {
  try { const valor = await CatalogoValor.findByPk(req.params.id); if (!valor) return res.status(404).json({ error: 'Valor no encontrado' }); res.json({ data: CatalogoValorDto.fromModel(valor) }); }
  catch (error) { next(error); }
};
const crear = async (req, res, next) => {
  try {
    const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ error: 'Datos inválidos', details: errors.array() });
    const data = CatalogoValorDto.fromCreate(req.body); const valor = await CatalogoValor.create(data);
    res.status(201).json({ data: CatalogoValorDto.fromModel(valor) });
  } catch (error) { next(error); }
};
const actualizar = async (req, res, next) => {
  try { const valor = await CatalogoValor.findByPk(req.params.id); if (!valor) return res.status(404).json({ error: 'Valor no encontrado' }); const data = CatalogoValorDto.fromUpdate(req.body); await valor.update(data); res.json({ data: CatalogoValorDto.fromModel(valor) }); }
  catch (error) { next(error); }
};
const eliminar = async (req, res, next) => {
  try { const valor = await CatalogoValor.findByPk(req.params.id); if (!valor) return res.status(404).json({ error: 'Valor no encontrado' }); await valor.destroy(); res.json({ message: 'Valor eliminado' }); }
  catch (error) { next(error); }
};
module.exports = { listar, obtener, crear, actualizar, eliminar };
