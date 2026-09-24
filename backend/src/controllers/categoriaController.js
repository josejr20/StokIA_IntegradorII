const { validationResult } = require('express-validator');
const { Categoria } = require('../models');
const { CategoriaDto } = require('../dtos/categoriaDto');
const logger = require('../utils/logger');

const listar = async (req, res, next) => {
  try {
    const categorias = await Categoria.findAll();
    res.json({ data: categorias.map(c => CategoriaDto.fromModel(c)) });
  } catch (error) { next(error); }
};

const obtener = async (req, res, next) => {
  try {
    const categoria = await Categoria.findByPk(req.params.id);
    if (!categoria) return res.status(404).json({ error: 'Categoría no encontrada' });
    res.json({ data: CategoriaDto.fromModel(categoria) });
  } catch (error) { next(error); }
};

const crear = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Datos inválidos', details: errors.array() });
    const data = CategoriaDto.fromCreate(req.body);
    const categoria = await Categoria.create(data);
    res.status(201).json({ data: CategoriaDto.fromModel(categoria) });
  } catch (error) { next(error); }
};

const actualizar = async (req, res, next) => {
  try {
    const categoria = await Categoria.findByPk(req.params.id);
    if (!categoria) return res.status(404).json({ error: 'Categoría no encontrada' });
    const data = CategoriaDto.fromUpdate(req.body);
    await categoria.update(data);
    res.json({ data: CategoriaDto.fromModel(categoria) });
  } catch (error) { next(error); }
};

const eliminar = async (req, res, next) => {
  try {
    const categoria = await Categoria.findByPk(req.params.id);
    if (!categoria) return res.status(404).json({ error: 'Categoría no encontrada' });
    await categoria.destroy();
    res.json({ message: 'Categoría eliminada' });
  } catch (error) { next(error); }
};

module.exports = { listar, obtener, crear, actualizar, eliminar };
