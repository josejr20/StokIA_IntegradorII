const { Op, col, fn, where } = require('sequelize');
const { Usuario, Rol, Permiso } = require('../models');
const { generarToken, generarRefreshToken } = require('../utils/jwt');

const login = async (identifier, password) => {
  const valor = typeof identifier === 'string' ? identifier.trim().toLowerCase() : '';
  if (!valor) throw new Error('Credenciales incorrectas');

  const usuarios = await Usuario.findAll({
    where: {
      [Op.or]: [
        { email: valor },
        where(fn('LOWER', col('nombres')), valor),
      ],
    },
    include: [{ model: Rol, as: 'rol', include: [{ model: Permiso, as: 'permisos', through: { attributes: [] } }] }],
    limit: 2,
  });
  if (usuarios.length !== 1) throw new Error('Credenciales incorrectas');

  const [usuario] = usuarios;
  if (!usuario.activo) throw new Error('Usuario inactivo');
  const valida = await usuario.validarPassword(password);
  if (!valida) throw new Error('Correo o contraseña incorrectos.');

  usuario.ultimo_acceso = new Date();
  await usuario.save({ fields: ['ultimo_acceso'] });

  const token = generarToken(usuario);
  const refreshToken = generarRefreshToken(usuario);

  return {
    usuario: {
      id: usuario.id,
      nombres: usuario.nombres,
      apellidos: usuario.apellidos,
      dni: usuario.dni || null,
      email: usuario.email,
      rol_id: usuario.rol_id,
      rol_nombre: usuario.rol?.nombre || null,
      permisos: usuario.rol?.permisos?.map((permiso) => permiso.codigo) || [],
      is_staff: usuario.is_staff,
      activo: usuario.activo,
    },
    token,
    refreshToken,
  };
};

module.exports = { login };
