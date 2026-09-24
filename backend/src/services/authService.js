const jwt = require('jsonwebtoken');
const { Usuario, Rol, Permiso } = require('../models');
const { generarToken, generarRefreshToken, verificarToken } = require('../utils/jwt');
const config = require('../config');
const logger = require('../utils/logger');
const bcrypt = require('bcryptjs');

const login = async (email, password) => {
  const usuario = await Usuario.findOne({
    where: { email },
    include: [{ model: Rol, as: 'rol', include: [{ model: Permiso, as: 'permisos', through: { attributes: [] } }] }],
  });
  if (!usuario) {
    throw new Error('Credenciales incorrectas');
  }
  if (!usuario.activo) {
    throw new Error('Usuario inactivo');
  }
  const valida = await usuario.validarPassword(password);
  if (!valida) {
    throw new Error('Correo o contraseña incorrectos.');
  }

  if (!usuario.password_hash && usuario.password) {
    await usuario.update({ password_hash: usuario.password });
  }

  usuario.ultimo_acceso = new Date();
  usuario.last_login = usuario.ultimo_acceso;
  await usuario.save({ fields: ['ultimo_acceso', 'last_login'] });

  const token = generarToken(usuario);
  const refreshToken = generarRefreshToken(usuario);

  return {
    usuario: {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol_id: usuario.rol_id,
      rol_nombre: usuario.rol?.nombre || null,
      permisos: usuario.rol?.permisos?.map((permiso) => permiso.codigo) || [],
      is_staff: usuario.is_staff,
      activo: usuario.activo
    },
    token,
    refreshToken
  };
};

module.exports = { login };
