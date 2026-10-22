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

const sequelizeLocal = new Sequelize(
  process.env.LOCAL_DB_NAME,
  process.env.LOCAL_DB_USER,
  process.env.LOCAL_DB_PASSWORD,
  {
    host: process.env.LOCAL_DB_HOST || 'localhost',
    port: Number(process.env.LOCAL_DB_PORT || 5432),
    dialect: process.env.LOCAL_DB_DIALECT || 'postgres',
    logging: false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  }
);

const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('Conexión a Supabase establecida correctamente.');
    return true;
  } catch (error) {
    console.error('Error al conectar a Supabase:', error.message);
    return false;
  }
};

const testLocalConnection = async () => {
  try {
    await sequelizeLocal.authenticate();
    console.log('Conexión a PostgreSQL local establecida correctamente.');
    return true;
  } catch (error) {
    console.error(
      'Error al conectar a PostgreSQL local:',
      error.message
    );
    return false;
  }
};

const testAllConnections = async () => {
  const results = await Promise.all([
    testConnection(),
    testLocalConnection(),
  ]);

  return {
    supabase: results[0],
    local: results[1],
  };
};

module.exports = {
  sequelize,        // Supabase: conexión original
  sequelizeLocal,   // PostgreSQL local
  testConnection,
  testLocalConnection,
  testAllConnections,
  Sequelize,
};
