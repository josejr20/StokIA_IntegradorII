require('dotenv').config();
const http = require('http');
const { app, start } = require('./src/app');
const { initSocket } = require('./src/config/socket');

// Inicializar la app (conexión a BD, etc.)
start().then(() => {
  // Crear el server HTTP con la app Express
  const server = http.createServer(app);

  // Inicializar Socket.IO
  const io = initSocket(server);
  app.set('io', io);

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor corriendo en puerto ${PORT} (con WebSocket)`);
  });
});