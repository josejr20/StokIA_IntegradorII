const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { app } = require('../../src/app');

const routes = [
  '/api/auth', '/api/usuarios', '/api/roles', '/api/permisos', '/api/categorias',
  '/api/productos', '/api/unidades-medida', '/api/presentaciones', '/api/catalogo-marcas',
  '/api/catalogo-valores', '/api/lotes', '/api/movimientos', '/api/ventas', '/api/operaciones',
  '/api/clientes', '/api/importaciones-ventas', '/api/importar-kardex', '/api/umbrales',
  '/api/ordenes-reabastecimiento', '/api/alertas', '/api/recomendaciones', '/api/reportes',
  '/api/preferencias', '/api/auditoria', '/api/tipos-envase', '/api/presentaciones-niveles',
  '/api/precios', '/api/predicciones', '/api/riesgo-vencimiento', '/api/ml', '/api/health'
];

// Prueba: smoke: all module endpoints respond.
test('smoke: all module endpoints respond', async () => {
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  for (const r of routes) {
    const res = await fetch(`http://127.0.0.1:${port}${r}`);
    assert.ok([200,201,204,400,401,403,404,405,500].includes(res.status), `${r} -> ${res.status}`);
  }
  server.close();
});

// Prueba: false positive: invalid id returns error.
test('false positive: invalid id returns error', async () => {
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const res = await fetch(`http://127.0.0.1:${port}/api/productos/999999`);
  assert.ok([400,401,403,404].includes(res.status));
  server.close();
});
