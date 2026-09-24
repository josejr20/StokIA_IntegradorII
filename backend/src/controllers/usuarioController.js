const { validationResult } = require('express-validator');
const { Usuario, Rol } = require('../models');
const { UsuarioDto } = require('../dtos/usuarioDto');
const { ApiError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const listar = async (req, res, next) => {
  try {
    const usuarios = await Usuario.findAll({ include: [{ model: Usuario.sequelize.models.Rol, as: 'rol' }] });
    res.json({ data: usuarios.map(u => UsuarioDto.fromModel(u)) });
  } catch (error) { next(error); }
};

const obtener = async (req, res, next) => {
  try {
    const usuario = await Usuario.findByPk(req.params.id, { include: [{ model: Usuario.sequelize.models.Rol, as: 'rol' }] });
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ data: UsuarioDto.fromModel(usuario) });
  } catch (error) { next(error); }
};

const crear = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Datos inválidos', details: errors.array() });
    const data = UsuarioDto.fromCreate(req.body);
    const usuario = await Usuario.create(data);
    res.status(201).json({ data: UsuarioDto.fromModel(usuario) });
  } catch (error) { next(error); }
};

const actualizar = async (req, res, next) => {
  try {
    const usuario = await Usuario.findByPk(req.params.id);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    const data = UsuarioDto.fromUpdate(req.body);
    await usuario.update(data);
    res.json({ data: UsuarioDto.fromModel(usuario) });
  } catch (error) { next(error); }
};

const desactivar = async (req, res, next) => {
  try {
    const usuario = await Usuario.findByPk(req.params.id);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    usuario.activo = false;
    await usuario.save();
    res.json({ data: UsuarioDto.fromModel(usuario), message: 'Usuario desactivado' });
  } catch (error) { next(error); }
};

const yo = async (req, res, next) => {
  try {
    const usuario = await Usuario.findByPk(req.user.id, { include: [{ model: Usuario.sequelize.models.Rol, as: 'rol' }] });
    res.json({ data: UsuarioDto.fromModel(usuario) });
  } catch (error) { next(error); }
};

module.exports = { listar, obtener, crear, actualizar, desactivar, yo };
