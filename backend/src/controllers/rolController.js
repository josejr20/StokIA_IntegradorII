const { validationResult } = require('express-validator');
const { Rol } = require('../models');
const { RolDto } = require('../dtos/rolDto');
const logger = require('../utils/logger');

const listar = async (req, res, next) => {
  try {
    const roles = await Rol.findAll();
    res.json({ data: roles.map(r => RolDto.fromModel(r)) });
  } catch (error) { next(error); }
};

const obtener = async (req, res, next) => {
  try {
    const rol = await Rol.findByPk(req.params.id);
    if (!rol) return res.status(404).json({ error: 'Rol no encontrado' });
    res.json({ data: RolDto.fromModel(rol) });
  } catch (error) { next(error); }
};

const crear = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Datos inválidos', details: errors.array() });
    const data = RolDto.fromCreate(req.body);
    const rol = await Rol.create(data);
    res.status(201).json({ data: RolDto.fromModel(rol) });
  } catch (error) { next(error); }
};

const actualizar = async (req, res, next) => {
  try {
    const rol = await Rol.findByPk(req.params.id);
    if (!rol) return res.status(404).json({ error: 'Rol no encontrado' });
    const data = RolDto.fromUpdate(req.body);
    await rol.update(data);
    res.json({ data: RolDto.fromModel(rol) });
  } catch (error) { next(error); }
};

const eliminar = async (req, res, next) => {
  try {
    const rol = await Rol.findByPk(req.params.id);
    if (!rol) return res.status(404).json({ error: 'Rol no encontrado' });
    await rol.destroy();
    res.json({ message: 'Rol eliminado' });
  } catch (error) { next(error); }
};

module.exports = { listar, obtener, crear, actualizar, eliminar };
