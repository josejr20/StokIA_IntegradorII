// backend/tests/helpers/testDb.js
// Aislamiento: solo PostgreSQL temporal, nunca Supabase.
const { Sequelize } = require('sequelize');

function buildTestSequelize() {
  const host = process.env.TEST_DB_HOST || 'localhost';
  const port = Number(process.env.TEST_DB_PORT || 5432);
  const name = process.env.TEST_DB_NAME || 'stockia_test';
  const user = process.env.TEST_DB_USER || 'stockia_test';
  const pass = process.env.TEST_DB_PASSWORD || 'stockia_test';
  const ssl = String(process.env.TEST_DB_SSL || 'false') === 'true';
  return new Sequelize(name, user, pass, {
    host, port, dialect: 'postgres', logging: false,
    dialectOptions: ssl ? { ssl: { require: true, rejectUnauthorized: false } } : {},
  });
}

function assertIsolated() {
  const host = process.env.TEST_DB_HOST || 'localhost';
  const name = process.env.TEST_DB_NAME || 'stockia_test';
  if (/supabase/i.test(host) || /supabase/i.test(name)) {
    throw new Error('Refusing to run tests against Supabase');
  }
  if (!process.env.TEST_DB_HOST) {
    throw new Error('TEST_DB_HOST must be set for isolation');
  }
}

module.exports = { buildTestSequelize, assertIsolated };
