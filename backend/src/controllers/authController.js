const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
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

const codigoHash = (codigo) => crypto.createHash('sha256').update(codigo).digest('hex');
const correoNormalizado = (email) => email.trim().toLowerCase();

const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Datos inválidos', details: errors.array() });
  }

  const { identifier, password } = LoginDto.fromBody(req.body);
  try {
    const { usuario, token, refreshToken } = await authService.login(identifier, password);
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
        ip: req.ip || null,
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
    try {
      const codigo = String(crypto.randomInt(100000, 1000000));
      await enviarCorreo(email, 'Solicitud de recuperación de contraseña', `<p>Tu código de recuperación es: <strong>${codigo}</strong></p><p>Este código expirará en ${config.RESET_CODE_TTL_MINUTES} minutos.</p>`);
      await TokenRecuperacion.update({ usado: true }, { where: { usuario_id: usuario.id, usado: false } });
      await TokenRecuperacion.create({
        usuario_id: usuario.id, code_hash: codigoHash(codigo),
        expira_en: new Date(Date.now() + config.RESET_CODE_TTL_MINUTES * 60 * 1000),
        intentos: 0, usado: false,
      });
    } catch (error) {
      logger.error(`No se pudo enviar el código de recuperación: ${error.message}`);
      const mensaje = error.code === 'EAUTH'
        ? 'El servidor SMTP rechazó las credenciales. Usa una contraseña de aplicación.'
        : 'El servicio de correo no está disponible.';
      return res.status(503).json({ error: mensaje });
    }
  }
  return res.json({ message: 'Si el correo está registrado, recibirás un código de recuperación.' });
};

const buscarCodigoValido = async (email, codigo, consumirIntento = true) => {
  const usuario = await Usuario.findOne({ where: { email, activo: true } });
  if (!usuario) return { usuario: null, token: null };
  const token = await TokenRecuperacion.findOne({ where: { usuario_id: usuario.id, usado: false }, order: [['fecha_creacion', 'DESC']] });
  if (!token || !token.code_hash || token.expira_en <= new Date() || token.intentos >= config.RESET_CODE_MAX_ATTEMPTS) return { usuario, token: null };
  if (consumirIntento) {
    await token.increment('intentos');
    await token.reload();
  }
  if (!crypto.timingSafeEqual(Buffer.from(token.code_hash), Buffer.from(codigoHash(codigo)))) return { usuario, token: null };
  return { usuario, token };
};

const verifyResetCode = async (req, res) => {
  const email = typeof req.body.email === 'string' ? correoNormalizado(req.body.email) : '';
  const resultado = await buscarCodigoValido(email, String(req.body.code || ''));
  if (!resultado.token) return res.status(400).json({ error: 'Código inválido o expirado' });
  return res.json({ valid: true });
};

const resetPassword = async (req, res) => {
  const email = typeof req.body.email === 'string' ? correoNormalizado(req.body.email) : '';
  const { usuario, token } = await buscarCodigoValido(email, String(req.body.code || ''), false);
  if (!token) return res.status(400).json({ error: 'Código inválido o expirado' });
  if (!cumplePoliticaPassword(req.body.password)) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres e incluir mayúscula, minúscula, número y carácter especial.' });
  }
  await usuario.update({ password_hash: await bcrypt.hash(req.body.password, 10) });
  await token.update({ usado: true });
  clearAuthCookies(res);
  return res.json({ message: 'Contraseña actualizada correctamente.' });
};

module.exports = { login, logout, refresh, me, forgotPassword, verifyResetCode, resetPassword };
