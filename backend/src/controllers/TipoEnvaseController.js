const { validationResult } = require('express-validator');
const { tipoEnvase } = require('../models');
const { TipoEnvaseDto } = require('../dtos/TipoEnvaseDto');
const logger = require('../utils/logger');

const listar = async (req, res, next) => {
  try {
    const tipos = await tipoEnvase.findAll();
    res.json({ data: tipos.map(t => TipoEnvaseDto.fromModel(t)) });
  } catch (error) { next(error); }
};

const obtener = async (req, res, next) => {
  try {
    const tipo = await tipoEnvase.findByPk(req.params.id);
    if (!tipo) return res.status(404).json({ error: 'Tipo de envase no encontrado' });
    res.json({ data: TipoEnvaseDto.fromModel(tipo) });
  } catch (error) { next(error); }
};

const crear = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Datos inválidos', details: errors.array() });
    const data = TipoEnvaseDto.fromCreate(req.body);
    const tipo = await tipoEnvase.create(data);
    res.status(201).json({ data: TipoEnvaseDto.fromModel(tipo) });
  } catch (error) { next(error); }
};

const actualizar = async (req, res, next) => {
  try {
    const tipo = await tipoEnvase.findByPk(req.params.id);
    if (!tipo) return res.status(404).json({ error: 'Tipo de envase no encontrado' });
    const data = TipoEnvaseDto.fromUpdate(req.body);
    await tipo.update(data);
    res.json({ data: TipoEnvaseDto.fromModel(tipo) });
  } catch (error) { next(error); }
};

module.exports = { listar, obtener, crear, actualizar };