const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { isIP } = require('node:net');
const { validationResult } = require('express-validator');
const { Usuario, Rol, Permiso, TokenRecuperacion } = require('../models');
const { LoginDto } = require('../dtos/authDto');
const { UsuarioDto } = require('../dtos/usuarioDto');
const authService = require('../services/authService');
const config = require('../config');
const logger = require('../utils/logger');
const { setAuthCookies, clearAuthCookies, readCookie } = require('../utils/authCookies');
const { enviarCorreo } = require('../services/correoService');
const { cumplePoliticaPassword } = require('../utils/passwordPolicy');

const tokenHash = (token) => crypto.createHash('sha256').update(token).digest('hex');
const correoNormalizado = (email) => email.trim().toLowerCase();
const RESET_TOKEN_TTL_MINUTES = 10;

async function obtenerIPPublica() {
  const respuesta = await fetch('https://api.ipify.org/?format=json', {
    signal: AbortSignal.timeout(5000),
  });
  if (!respuesta.ok) {
    throw new Error(`ipify respondió con estado ${respuesta.status}`);
  }

  const datos = await respuesta.json();
  const ip = typeof datos.ip === 'string' ? datos.ip.trim() : '';
  if (!isIP(ip) || ip === '127.0.0.1' || ip === '::1') {
    throw new Error('ipify no devolvió una IP pública válida');
  }
  return ip;
}

const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Datos inválidos', details: errors.array() });
  }

  const { identifier, password } = LoginDto.fromBody(req.body);
  let ip = null;
  try {
    ip = await obtenerIPPublica();
  } catch (error) {
    logger.warn(`No se pudo obtener la IP pública desde ipify; el login continuará sin IP: ${error.message}`);
  }

  try {
    const { usuario, token, refreshToken } = await authService.login(identifier, password, ip);
    setAuthCookies(res, token, refreshToken);
    return res.json({
      usuario,
      session: { accessTokenExpiresIn: config.JWT_EXPIRES_IN, refreshTokenExpiresIn: config.JWT_REFRESH_EXPIRES_IN },
    });
  } catch (error) {
    logger.warn(`Login fallido: ${error.message}`);
    try {
      const { crearAuditoria } = require('../middleware/auditoria');
      await crearAuditoria(null, 'login_fallido', 'auth', null, {
        identifier: typeof identifier === 'string' ? identifier.trim() : null,
        motivo: error.message || 'Credenciales incorrectas',
        ip: ip,
        user_agent: req.get('user-agent') || null,
      });
    } catch (auditError) {
      logger.warn(`No se pudo registrar auditoría de login fallido: ${auditError.message}`);
    }
    return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
  }
};

const logout = (req, res) => {
  clearAuthCookies(res);
  return res.status(204).send();
};

const refresh = async (req, res) => {
  try {
    const refreshToken = readCookie(req, 'stockia_refresh') || req.body.refreshToken;
    if (!refreshToken) return res.status(401).json({ error: 'Refresh token no proporcionado' });
    const decoded = jwt.verify(refreshToken, config.JWT_SECRET);
    const usuario = await Usuario.findByPk(decoded.id);
    if (!usuario || !usuario.activo) {
      return res.status(401).json({ error: 'Usuario no válido' });
    }
    const token = jwt.sign({ id: usuario.id, email: usuario.email, rol_id: usuario.rol_id }, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRES_IN });
    setAuthCookies(res, token, refreshToken);
    return res.json({
      ok: true,
      session: { accessTokenExpiresIn: config.JWT_EXPIRES_IN, refreshTokenExpiresIn: config.JWT_REFRESH_EXPIRES_IN },
    });
  } catch (error) {
    return res.status(401).json({ error: 'Refresh token inválido' });
  }
};

const me = async (req, res, next) => {
  try {
    const usuario = await Usuario.findByPk(req.user.id, {
      attributes: { exclude: ['password_hash'] },
      include: [{ model: Rol, as: 'rol', include: [{ model: Permiso, as: 'permisos', through: { attributes: [] } }] }],
    });
    if (!usuario || !usuario.activo) return res.status(401).json({ error: 'Usuario no válido' });
    return res.json({ data: new UsuarioDto(usuario) });
  } catch (error) {
    next(error);
  }
};

const forgotPassword = async (req, res) => {
  const email = typeof req.body.email === 'string' ? correoNormalizado(req.body.email) : '';
  const usuario = email ? await Usuario.findOne({ where: { email, activo: true } }) : null;
  if (usuario) {
    await TokenRecuperacion.update({ usado: true }, { where: { usuario_id: usuario.id, usado: false } });
    const token = crypto.randomBytes(32).toString('hex');
    const tokenRecuperacion = await TokenRecuperacion.create({
      usuario_id: usuario.id,
      token: tokenHash(token),
      expira_en: new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000),
      intentos: 0,
      usado: false,
    });
    const enlace = new URL('/restablecer', config.FRONTEND_URL);
    enlace.searchParams.set('token', token);

    try {
      await enviarCorreo(
        email,
        'Restablecimiento de contraseña',
        `<p>Recibimos una solicitud para cambiar la contraseña de tu cuenta.</p><p><a href="${enlace.toString()}">Restablecer contraseña</a></p><p>Este enlace expirará en ${RESET_TOKEN_TTL_MINUTES} minutos y solo puede utilizarse una vez.</p>`,
      );
    } catch (error) {
      await tokenRecuperacion.update({ usado: true });
      logger.error(`No se pudo enviar el enlace de recuperación: ${error.message}`);
      const mensaje = error.code === 'EAUTH'
        ? 'El servidor SMTP rechazó las credenciales. Usa una contraseña de aplicación.'
        : 'El servicio de correo no está disponible.';
      return res.status(503).json({ error: mensaje });
    }
  }
  return res.json({ message: 'Si el correo está registrado, recibirás un enlace de recuperación.' });
};

const resetPassword = async (req, res) => {
  const tokenBruto = typeof req.body.token === 'string' ? req.body.token : '';
  if (!/^[a-f0-9]{64}$/i.test(tokenBruto)) {
    return res.status(400).json({ error: 'El enlace de restablecimiento es inválido o expiró.' });
  }
  const token = await TokenRecuperacion.findOne({
    where: { token: tokenHash(tokenBruto), usado: false },
  });
  if (!token || token.expira_en <= new Date()) {
    return res.status(400).json({ error: 'El enlace de restablecimiento es inválido o expiró.' });
  }
  const usuario = await Usuario.findByPk(token.usuario_id);
  if (!usuario || !usuario.activo) {
    return res.status(400).json({ error: 'El enlace de restablecimiento es inválido o expiró.' });
  }
  const currentPassword = typeof req.body.currentPassword === 'string' ? req.body.currentPassword : '';
  if (!currentPassword || !usuario.password_hash || !(await bcrypt.compare(currentPassword, usuario.password_hash))) {
    return res.status(400).json({ error: 'La contraseña actual es incorrecta.' });
  }
  if (!cumplePoliticaPassword(req.body.password)) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres e incluir mayúscula, minúscula, número y carácter especial.' });
  }
  if (await bcrypt.compare(req.body.password, usuario.password_hash)) {
    return res.status(400).json({ error: 'La nueva contraseña debe ser diferente a la contraseña actual.' });
  }
  const filasActualizadas = await TokenRecuperacion.update(
    { usado: true },
    { where: { id: token.id, token: token.token, usado: false, expira_en: { [Op.gt]: new Date() } } },
  );
  if (filasActualizadas[0] !== 1) {
    return res.status(400).json({ error: 'El enlace de restablecimiento es inválido o expiró.' });
  }
  await usuario.update({ password_hash: await bcrypt.hash(req.body.password, 10) });
  clearAuthCookies(res);
  return res.json({ message: 'Contraseña actualizada correctamente.' });
};

const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (typeof currentPassword !== 'string' || !currentPassword
    || typeof newPassword !== 'string' || !newPassword) {
    return res.status(400).json({ error: 'Ingresa la contraseña actual y la nueva contraseña.' });
  }

  const usuario = await Usuario.findByPk(req.user.id);
  if (!usuario || !usuario.activo) {
    return res.status(401).json({ error: 'Usuario no válido' });
  }
  if (!usuario.password_hash || !(await bcrypt.compare(currentPassword, usuario.password_hash))) {
    return res.status(400).json({ error: 'La contraseña actual es incorrecta.' });
  }
  if (!cumplePoliticaPassword(newPassword)) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres e incluir mayúscula, minúscula, número y carácter especial.' });
  }
  if (await bcrypt.compare(newPassword, usuario.password_hash)) {
    return res.status(400).json({ error: 'La nueva contraseña debe ser diferente a la contraseña actual.' });
  }

  await usuario.update({ password_hash: await bcrypt.hash(newPassword, 10) });
  return res.json({ message: 'Contraseña actualizada correctamente.' });
};

module.exports = { login, logout, refresh, me, forgotPassword, resetPassword, changePassword };
