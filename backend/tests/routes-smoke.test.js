const test = require('node:test');
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

test('todas las rutas cargan (sin dependencias faltantes)', () => {
  require('../src/routes');
});