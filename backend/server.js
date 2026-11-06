require('dotenv').config();
const http = require('http');
const { app, start } = require('./src/app');
const { initSocket } = require('./src/config/socket');

// Inicializar la app (conexión a BD, etc.)
start().then(() => {
  // Crear el server HTTP con la app Express
  const server = http.createServer(app);
  const PORT = process.env.PORT || 3000;

  // Inicializar Socket.IO
  const io = initSocket(server);
  app.set('io', io);

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`El puerto ${PORT} ya está en uso. Libérelo o configure PORT con otro puerto.`);
      process.exitCode = 1;
      return;
    }

    console.error('No se pudo iniciar el servidor HTTP:', error);
    process.exitCode = 1;
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor corriendo en puerto ${PORT} (con WebSocket)`);
  });
}).catch((error) => {
  console.error('No se pudo inicializar el backend:', error);
  process.exitCode = 1;
});