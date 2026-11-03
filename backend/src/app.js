const express = require('express');
const cors = require('cors');
const path = require('path');
const { testConnection } = require('./config/database');
const { setupSwagger } = require('./config/swagger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const logger = require('./utils/logger');

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
// El limite alto es para la carga masiva de productos (POST /api/productos/importar),
// que envia hasta 500 filas en una sola peticion.
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/upload', express.static(path.resolve(__dirname, '../upload')));

setupSwagger(app);

app.get('/', (req, res) => {
  res.json({
    message: 'StockIA API - Express + MVC + DTO',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      usuarios: '/api/usuarios',
      roles: '/api/roles',
      permisos: '/api/permisos',
      categorias: '/api/categoria',
      productos: '/api/productos',
      lotes: '/api/lotes',
      movimientos: '/api/movimientos',
      ventas: '/api/ventas',
      alertas: '/api/alertas',
      reportes: '/api/reportes',
      auditoria: '/api/auditoria'
    }
  });
});

app.use('/api', require('./routes'));
app.use(notFoundHandler);
app.use(errorHandler);

const { testLocalConnection } = require('./config/database');

const start = async () => {
  const connected = await testConnection();
  if (!connected) {
    logger.error('No se pudo conectar a la base de datos. Abortando.');
    process.exit(1);
  }
  try {
    await testLocalConnection();
    console.log('Conexión de manera local establecida correctamente');
  } catch (err) {
    // no abortar
  }
  // No modificar automáticamente el esquema de la BD compartida.
  // Habilitar únicamente en un entorno controlado.
  if (process.env.DB_SYNC_ENABLED === 'true') {
    try {
      await require('./models').sequelize.sync({ alter: false });
      logger.info('Sincronización de modelos completada');
    } catch (err) {
      logger.error(`Error sincronizando modelos: ${err.message}`);
      console.error(err);
    }
  } else {
    logger.info('Sincronización automática de modelos desactivada');
  }
  // HU-133: tarea programada de reabastecimiento.
  // Desactivada por defecto. Solo ejecuta simulaciones.
  if (process.env.REABASTECIMIENTO_CRON_ENABLED === 'true') {
    const {
      iniciarReabastecimientoCron
    } = require('./services/reabastecimientoCron');

    iniciarReabastecimientoCron();
    logger.info('[HU-133] Cron de simulación habilitado');
  } else {
    logger.info('[HU-133] Cron de simulación desactivado');
  }
};

module.exports = { app, start };