const express = require('express');
const cors = require('cors');
const path = require('path');
const { testConnection } = require('./config/database');
const { setupSwagger } = require('./config/swagger');
const logger = require('./utils/logger');

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
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
      categorias: '/api/categorias',
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

app.use((err, req, res, next) => {
  logger.error(err.message, { stack: err.stack });
  res.status(err.status || 500).json({
    error: err.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

const start = async () => {
  const connected = await testConnection();
  if (!connected) {
    logger.error('No se pudo conectar a la base de datos. Abortando.');
    process.exit(1);
  }
  try {
    await require('./models').sequelize.sync({ alter: false });
    logger.info('Modelos sincronizados');
  }  catch (err) {
    logger.error(`Error sincronizando modelos: ${err.message}`);
    console.error(err);
  }

  app.listen(process.env.PORT || 3000, () => {
    logger.info(`Servidor corriendo en puerto ${process.env.PORT || 3000}`);
    logger.info(`Entorno: ${process.env.NODE_ENV || 'development'}`);
  });
};

module.exports = { app, start };
