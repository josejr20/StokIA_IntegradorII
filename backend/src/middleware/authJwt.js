const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../utils/logger');
const { readCookie } = require('../utils/authCookies');

const autenticar = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : readCookie(req, 'stockia_access');
    if (!token) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }

    const decoded = jwt.verify(token, config.JWT_SECRET);

    const { Usuario } = require('../models');
    const usuario = await Usuario.findByPk(decoded.id);
    if (!usuario || !usuario.activo) {
      return res.status(401).json({ error: 'Usuario no válido o inactivo' });
    }

    req.user = usuario;
    next();
  } catch (error) {
    logger.warn('Token inválido:', error.message);
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

module.exports = { autenticar };
