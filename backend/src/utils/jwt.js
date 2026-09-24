const jwt = require('jsonwebtoken');
const config = require('../config');

const generarToken = (usuario) => {
  return jwt.sign(
    { id: usuario.id, email: usuario.email, rol_id: usuario.rol_id },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRES_IN }
  );
};

const generarRefreshToken = (usuario) => {
  return jwt.sign(
    { id: usuario.id, email: usuario.email },
    config.JWT_SECRET,
    { expiresIn: config.JWT_REFRESH_EXPIRES_IN }
  );
};

const verificarToken = (token) => {
  return jwt.verify(token, config.JWT_SECRET);
};

module.exports = { generarToken, generarRefreshToken, verificarToken };
