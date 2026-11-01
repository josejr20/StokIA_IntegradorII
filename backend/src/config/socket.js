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

  // Middleware de autenticación por JWT en handshake
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      return next(new Error('No autorizado: token requerido'));
    }
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = payload.id;
      socket.userRol = payload.rol;
      next();
    } catch (error) {
      next(new Error('No autorizado: token inválido'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`WebSocket conectado: userId=${socket.userId} socket=${socket.id}`);

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