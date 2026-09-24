require('dotenv').config();
const { Sequelize } = require('sequelize');
const config = require('./index');

const sequelize = new Sequelize(
  config.DB_NAME,
  config.DB_USER,
  config.DB_PASSWORD,
  {
    host: config.DB_HOST,
    port: config.DB_PORT,
    dialect: config.DB_DIALECT,
    logging: false,
    pool: {
      max: 10,
      min: 2,
      acquire: 30000,
      idle: 10000
    }
  }
);

const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('Conexión a PostgreSQL establecida correctamente.');
    return true;
  } catch (error) {
    console.error('Error al conectar a PostgreSQL:', error.message);
    return false;
  }
};

module.exports = {
  sequelize,
  testConnection,
  Sequelize
};
