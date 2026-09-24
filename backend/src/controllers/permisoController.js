const { validationResult } = require('express-validator');
const { Permiso } = require('../models');
const { PermisoDto } = require('../dtos/permisoDto');
const logger = require('../utils/logger');

const listar = async (req, res, next) => {
  try {
    const permisos = await Permiso.findAll();
    res.json({ data: permisos.map(p => PermisoDto.fromModel(p)) });
  } catch (error) { next(error); }
};

const obtener = async (req, res, next) => {
  try {
    const permiso = await Permiso.findByPk(req.params.id);
    if (!permiso) return res.status(404).json({ error: 'Permiso no encontrado' });
    res.json({ data: PermisoDto.fromModel(permiso) });
  } catch (error) { next(error); }
};

const crear = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Datos inválidos', details: errors.array() });
    const data = PermisoDto.fromCreate(req.body);
    const permiso = await Permiso.create(data);
    res.status(201).json({ data: PermisoDto.fromModel(permiso) });
  } catch (error) { next(error); }
};

const actualizar = async (req, res, next) => {
  try {
    const permiso = await Permiso.findByPk(req.params.id);
    if (!permiso) return res.status(404).json({ error: 'Permiso no encontrado' });
    const data = PermisoDto.fromUpdate(req.body);
    await permiso.update(data);
    res.json({ data: PermisoDto.fromModel(permiso) });
  } catch (error) { next(error); }
};

const eliminar = async (req, res, next) => {
  try {
    const permiso = await Permiso.findByPk(req.params.id);
    if (!permiso) return res.status(404).json({ error: 'Permiso no encontrado' });
    await permiso.destroy();
    res.json({ message: 'Permiso eliminado' });
  } catch (error) { next(error); }
};

module.exports = { listar, obtener, crear, actualizar, eliminar };
