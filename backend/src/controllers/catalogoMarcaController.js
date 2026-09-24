const { validationResult } = require('express-validator');
const { CatalogoMarca } = require('../models');
const { CatalogoMarcaDto } = require('../dtos/catalogoMarcaDto');
const logger = require('../utils/logger');

const listar = async (req, res, next) => {
  try { const marcas = await CatalogoMarca.findAll(); res.json({ data: marcas.map(m => CatalogoMarcaDto.fromModel(m)) }); }
  catch (error) { next(error); }
};
const obtener = async (req, res, next) => {
  try { const marca = await CatalogoMarca.findByPk(req.params.id); if (!marca) return res.status(404).json({ error: 'Marca no encontrada' }); res.json({ data: CatalogoMarcaDto.fromModel(marca) }); }
  catch (error) { next(error); }
};
const crear = async (req, res, next) => {
  try {
    const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ error: 'Datos inválidos', details: errors.array() });
    const data = CatalogoMarcaDto.fromCreate(req.body); const marca = await CatalogoMarca.create(data);
    res.status(201).json({ data: CatalogoMarcaDto.fromModel(marca) });
  } catch (error) { next(error); }
};
const actualizar = async (req, res, next) => {
  try { const marca = await CatalogoMarca.findByPk(req.params.id); if (!marca) return res.status(404).json({ error: 'Marca no encontrada' }); const data = CatalogoMarcaDto.fromUpdate(req.body); await marca.update(data); res.json({ data: CatalogoMarcaDto.fromModel(marca) }); }
  catch (error) { next(error); }
};
const eliminar = async (req, res, next) => {
  try { const marca = await CatalogoMarca.findByPk(req.params.id); if (!marca) return res.status(404).json({ error: 'Marca no encontrada' }); await marca.destroy(); res.json({ message: 'Marca eliminada' }); }
  catch (error) { next(error); }
};
module.exports = { listar, obtener, crear, actualizar, eliminar };
