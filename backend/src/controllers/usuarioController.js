const crypto = require('crypto');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');
const { Usuario, Rol } = require('../models');
const { UsuarioDto } = require('../dtos/usuarioDto');
const config = require('../config');

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
    const secretoConfigurado = config.USER_CREATION_SECRET;
    const secretoRecibido = req.body.clave_secreta;
    if (!secretoConfigurado) {
      return res.status(503).json({ error: 'La creación de usuarios no está configurada en el servidor' });
    }
    if (typeof secretoRecibido !== 'string' || !crypto.timingSafeEqual(
      crypto.createHash('sha256').update(secretoRecibido).digest(),
      crypto.createHash('sha256').update(secretoConfigurado).digest()
    )) {
      return res.status(403).json({ error: 'Clave secreta incorrecta' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Datos inválidos', details: errors.array() });
    const { nombres, apellidos, dni, email, password, rol_id } = req.body;
    if (typeof nombres !== 'string' || nombres.trim().length < 2) {
      return res.status(400).json({ error: 'Ingresa los nombres del empleado' });
    }
    if (typeof apellidos !== 'string' || apellidos.trim().length < 2) {
      return res.status(400).json({ error: 'Ingresa los apellidos del empleado' });
    }
    if (typeof dni !== 'string' || !dni.trim()) {
      return res.status(400).json({ error: 'Ingresa el DNI del empleado' });
    }
    if (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      return res.status(400).json({ error: 'Ingresa un correo válido' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }
    const rol = await Rol.findByPk(Number(rol_id));
    if (!rol) return res.status(400).json({ error: 'Selecciona un rol válido' });
    const emailNormalizado = email.trim().toLowerCase();
    const dniNormalizado = dni.trim();
    const existente = await Usuario.findOne({
      where: { [Op.or]: [{ email: emailNormalizado }, { dni: dniNormalizado }] },
    });
    if (existente?.email === emailNormalizado) return res.status(409).json({ error: 'El correo ya está registrado' });
    if (existente?.dni === dniNormalizado) return res.status(409).json({ error: 'El DNI ya está registrado' });

    const data = {
      nombres: nombres.trim(),
      apellidos: apellidos.trim(),
      dni: dniNormalizado,
      email: emailNormalizado,
      password_hash: password,
      rol_id: rol.id,
      activo: true,
    };
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
    const usuario = await Usuario.findByPk(req.user.id, {
      attributes: { exclude: ['password', 'password_hash'] },
      include: [{ model: Usuario.sequelize.models.Rol, as: 'rol' }]
    });
    res.json({ data: UsuarioDto.fromModel(usuario) });
  } catch (error) {
    next(error);
  }
};

module.exports = { listar, obtener, crear, actualizar, desactivar, yo };
