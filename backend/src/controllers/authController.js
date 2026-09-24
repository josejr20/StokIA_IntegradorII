const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const { validationResult } = require('express-validator');
const { Usuario, Rol, Permiso, TokenRecuperacion } = require('../models');
const { LoginDto } = require('../dtos/authDto');
const { UsuarioDto } = require('../dtos/usuarioDto');
const authService = require('../services/authService');
const config = require('../config');
const logger = require('../utils/logger');
const { setAuthCookies, clearAuthCookies, readCookie } = require('../utils/authCookies');
const { enviarCorreo } = require('../services/correoService');
const { generarToken, generarRefreshToken } = require('../utils/jwt');

const codigoHash = (codigo) => crypto.createHash('sha256').update(codigo).digest('hex');
const correoNormalizado = (email) => email.trim().toLowerCase();
const clienteGoogle = new OAuth2Client(config.GOOGLE_CLIENT_ID || undefined);

const verificarCredencialGoogle = async (credential) => {
  const ticket = await clienteGoogle.verifyIdToken({ idToken: credential, audience: config.GOOGLE_CLIENT_ID });
  const payload = ticket.getPayload();
  if (!payload || !payload.sub || !payload.email || !payload.email_verified || !['https://accounts.google.com', 'accounts.google.com'].includes(payload.iss)) {
    throw new Error('Credencial de Google inválida');
  }
  return payload;
};

const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Datos inválidos', details: errors.array() });
  }

  try {
    const { email, password } = LoginDto.fromBody(req.body);
    const { usuario, token, refreshToken } = await authService.login(correoNormalizado(email), password);
    setAuthCookies(res, token, refreshToken);
    return res.json({
      usuario,
      session: { accessTokenExpiresIn: config.JWT_EXPIRES_IN, refreshTokenExpiresIn: config.JWT_REFRESH_EXPIRES_IN },
    });
  } catch (error) {
    logger.warn('Login fallido:', error.message);
    return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
  }
};

const registrar = async (req, res) => {
  const { nombre, email, password, confirmacion } = req.body;

  if (typeof nombre !== 'string' || nombre.trim().length < 2) {
    return res.status(400).json({ error: 'El nombre debe tener al menos 2 caracteres' });
  }
  if (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email.trim())) {
    return res.status(400).json({ error: 'Ingresa un correo válido' });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
  }
  if (confirmacion !== undefined && password !== confirmacion) {
    return res.status(400).json({ error: 'Las contraseñas no coinciden' });
  }

  try {
    const emailNormalizado = correoNormalizado(email);
    const existente = await Usuario.findOne({ where: { email: emailNormalizado } });
    if (existente) return res.status(409).json({ error: 'El correo ya está registrado' });

    const rol = await Rol.findOne({ where: { nombre: 'Encargado de Inventario' } });
    if (!rol) return res.status(500).json({ error: 'El rol de inventario no está configurado' });

    const usuario = await Usuario.create({
      nombre: nombre.trim(),
      email: emailNormalizado,
      password_hash: password,
      rol_id: rol.id,
      activo: true,
      provider: 'local',
      email_verified: false,
    });

    return res.status(201).json({ data: UsuarioDto.fromModel(usuario) });
  } catch (error) {
    logger.error('Error registrando usuario:', error.message);
    return res.status(500).json({ error: 'No se pudo registrar el usuario' });
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
      attributes: { exclude: ['password', 'password_hash'] },
      include: [{ model: Rol, as: 'rol', include: [{ model: Permiso, as: 'permisos', through: { attributes: [] } }] }],
    });
    if (!usuario || !usuario.activo) return res.status(401).json({ error: 'Usuario no válido' });
    return res.json({ data: new UsuarioDto(usuario) });
  } catch (error) {
    next(error);
  }
};

const google = async (req, res) => {
  if (!config.GOOGLE_CLIENT_ID) return res.status(503).json({ error: 'Google Login no está configurado' });
  try {
    const payload = await verificarCredencialGoogle(req.body.credential);

    const email = correoNormalizado(payload.email);
    let usuario = await Usuario.findOne({ where: { google_id: payload.sub, activo: true } });
    const usuarioPorEmail = await Usuario.findOne({ where: { email, activo: true } });

    if (usuarioPorEmail && usuario && usuarioPorEmail.id !== usuario.id) {
      return res.status(409).json({
        success: false,
        code: 'GOOGLE_ACCOUNT_CONFLICT',
        message: 'La cuenta de Google ya está vinculada a otro usuario.',
      });
    }

    if (!usuario) usuario = usuarioPorEmail;
    if (!usuario) {
      return res.status(403).json({
        success: false,
        code: 'USER_NOT_REGISTERED',
        message: 'No tienes una cuenta registrada. Debes registrarte primero.',
      });
    }

    if (usuario.google_id && usuario.google_id !== payload.sub) {
      return res.status(409).json({
        success: false,
        code: 'GOOGLE_ACCOUNT_CONFLICT',
        message: 'El correo ya está vinculado a otra cuenta de Google.',
      });
    }

    if (!usuario.google_id) {
      await usuario.update({ google_id: payload.sub, avatar: payload.picture || usuario.avatar, email_verified: true });
    } else if (payload.picture && payload.picture !== usuario.avatar) {
      await usuario.update({ avatar: payload.picture, email_verified: true });
    }

    const ultimoAcceso = new Date();
    await usuario.update({ ultimo_acceso: ultimoAcceso, last_login: ultimoAcceso });

    const token = generarToken(usuario);
    const refreshToken = generarRefreshToken(usuario);
    setAuthCookies(res, token, refreshToken);
    return res.json({
      usuario: UsuarioDto.fromModel(usuario),
      session: { accessTokenExpiresIn: config.JWT_EXPIRES_IN, refreshTokenExpiresIn: config.JWT_REFRESH_EXPIRES_IN },
    });
  } catch (error) {
    logger.warn('Login Google fallido:', error.message);
    return res.status(401).json({ error: 'Credencial de Google inválida' });
  }
};

const registrarGoogle = async (req, res) => {
  if (!config.GOOGLE_CLIENT_ID) return res.status(503).json({ error: 'Google Login no está configurado' });
  try {
    const payload = await verificarCredencialGoogle(req.body.credential);
    const email = correoNormalizado(payload.email);
    const existentePorGoogle = await Usuario.findOne({ where: { google_id: payload.sub } });
    const existentePorEmail = await Usuario.findOne({ where: { email } });

    if (existentePorGoogle || existentePorEmail) {
      return res.status(409).json({
        success: false,
        code: 'GOOGLE_ACCOUNT_EXISTS',
        message: 'Ya existe una cuenta registrada con este correo. Inicia sesión.',
      });
    }

    const rol = await Rol.findOne({ where: { nombre: 'Encargado de Inventario' } });
    if (!rol) return res.status(500).json({ error: 'El rol de inventario no está configurado' });

    const usuario = await Usuario.create({
      nombre: payload.name || email.split('@')[0],
      email,
      password_hash: null,
      rol_id: rol.id,
      google_id: payload.sub,
      avatar: payload.picture || null,
      provider: 'google',
      email_verified: true,
      activo: true,
    });

    return res.status(201).json({
      success: true,
      message: 'Cuenta registrada correctamente. Ahora puedes iniciar sesión con Google.',
      data: UsuarioDto.fromModel(usuario),
    });
  } catch (error) {
    if (error?.original?.code === '23505') {
      return res.status(409).json({
        success: false,
        code: 'GOOGLE_ACCOUNT_EXISTS',
        message: 'Ya existe una cuenta registrada con este correo. Inicia sesión.',
      });
    }
    logger.warn('Registro Google fallido:', error.message);
    return res.status(401).json({ error: 'Credencial de Google inválida' });
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
  if (!token || typeof req.body.password !== 'string' || req.body.password.length < 8) {
    return res.status(400).json({ error: 'Código inválido o contraseña no válida' });
  }
  await usuario.update({ password_hash: await bcrypt.hash(req.body.password, 10) });
  await token.update({ usado: true });
  clearAuthCookies(res);
  return res.json({ message: 'Contraseña actualizada correctamente.' });
};

module.exports = { login, registrar, registrarGoogle, logout, refresh, me, google, forgotPassword, verifyResetCode, resetPassword };
