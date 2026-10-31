const { testConnection } = require('../config/database');
const { seedInicial } = require('../services/seedService');
const logger = require('../utils/logger');

const seed = async () => {
  const connected = await testConnection();
  if (!connected) {
    logger.error('No se pudo conectar a la base de datos');
    process.exit(1);
  }

  try {
    await seedInicial();
  } catch (error) {
    logger.error('Error en seed:', error.message);
    process.exit(1)
  }
};

seed();