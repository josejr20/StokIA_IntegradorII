const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io = null;

/** Lee la cookie stockia_access del header Cookie del handshake. */
function extraerTokenCookie(cookieHeader) {
  if (!cookieHeader || typeof cookieHeader !== 'string') return null;
  const par = cookieHeader.split(';').map((item) => item.trim())
    .find((item) => item.startsWith('stockia_access='));
  return par ? decodeURIComponent(par.slice('stockia_access='.length)) : null;
}

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
      credentials: true,
    },
    path: '/socket.io',
  });

  // Autenticacion mediante JWT y la cookie HttpOnly existente.
  io.use(async (socket, next) => {
    try {
      const origenPermitido = process.env.CORS_ORIGIN || 'http://localhost:5173';
      const origen = socket.handshake.headers.origin;

      if (
        typeof origen !== 'string' ||
        !origenPermitido.split(',').map(v => v.trim()).includes(origen)
      ) {
        return next(new Error('No autorizado: origen no permitido'));
      }

      const token = socket.handshake.auth?.token
        || extraerTokenCookie(socket.handshake.headers.cookie);
      if (!token) {
        return next(new Error('No autorizado: token requerido'));
      }

      const payload = jwt.verify(token, process.env.JWT_SECRET);

      // Revalidar que la cuenta siga activa y conservar el nombre del rol para las salas.
      const { Usuario, Rol } = require('../models');
      const usuario = await Usuario.findByPk(payload.id, {
        attributes: ['id', 'rol_id', 'activo'],
        include: [{ model: Rol, as: 'rol', attributes: ['nombre'] }],
      });

      if (!usuario || !usuario.activo) {
        return next(new Error('No autorizado: usuario inactivo'));
      }

      socket.userId = usuario.id;
      socket.userRol = usuario.rol?.nombre ?? null;

      next();
    } catch (error) {
      return next(new Error('No autorizado: token invalido'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('subscribe:encargados_inventario', () => {
      const rolesAutorizados = new Set(['Administrador', 'Encargado de Inventario']);
      if (rolesAutorizados.has(socket.userRol)) {
        socket.join('encargados_inventario');
      }
    });
  });

  return io;
}

function getIO() {
  if (!io) {
    throw new Error('Socket.IO no ha sido inicializado');
  }
  return io;
}

module.exports = { initSocket, getIO };
