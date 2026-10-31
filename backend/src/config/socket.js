const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io = null;

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
      credentials: true,
    },
    path: '/socket.io',
  });


  // Autenticación mediante la cookie HttpOnly existente.
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

      const cookies = socket.handshake.headers.cookie || '';
      const cookie = cookies
        .split(';')
        .map(item => item.trim())
        .find(item => item.startsWith('stockia_access='));

      if (!cookie) {
        return next(new Error('No autorizado: sesión requerida'));
      }

      const token = decodeURIComponent(
        cookie.slice('stockia_access='.length)
      );

      const payload = jwt.verify(token, process.env.JWT_SECRET);

      // Verificar que la cuenta siga activa y que su rol
      // no haya cambiado desde que se emitió el token.
      const { Usuario } = require('../models');
      const usuario = await Usuario.findByPk(payload.id, {
        attributes: ['id', 'rol_id', 'activo'],
      });

      if (!usuario || !usuario.activo) {
        return next(new Error('No autorizado: usuario inactivo'));
      }

      socket.userId = usuario.id;
      socket.userRol = usuario.rol_id;

      next();
    } catch (error) {
      next(new Error('No autorizado: sesión inválida'));
    }
  });


  io.on('connection', (socket) => {
    console.log(`WebSocket conectado: userId=${socket.userId} socket=${socket.id}`);

    // Sala exclusiva para encargados de inventario (rol ID 2).
    if (Number(socket.userRol) === 2) {
      socket.join('encargados_inventario');
      console.log(`Usuario ${socket.userId} unido a encargados_inventario`);
    }

    socket.on('disconnect', () => {
      console.log(`WebSocket desconectado: socket=${socket.id}`);
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

/**
 * Emite un evento a todos los sockets conectados.
 * @param {string} event - Nombre del evento
 * @param {*} data - Datos a enviar
 */
function emit(event, data) {
  if (io) io.emit(event, data);
}

module.exports = { initSocket, getIO, emit };