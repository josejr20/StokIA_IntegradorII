// HU-82 — La ruta de entrenamiento del modelo está montada y exige sesión (no se puede entrenar sin autenticarse).
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { app } = require('../../src/app');

async function peticion(metodo, ruta) {
  const server = http.createServer(app);
  await new Promise((resolver) => server.listen(0, resolver));
  try {
    return await fetch(`http://127.0.0.1:${server.address().port}${ruta}`, { method: metodo });
  } finally {
    server.close();
  }
}

test('HU-82: POST /api/ml/entrenamientos exige autenticación', async () => {
  const res = await peticion('POST', '/api/ml/entrenamientos');
  assert.equal(res.status, 401);
});

test('HU-82: GET /api/ml/modelos exige autenticación', async () => {
  const res = await peticion('GET', '/api/ml/modelos');
  assert.equal(res.status, 401);
});

// HU-88 — las rutas de métricas también exigen sesión.
test('HU-88: GET /api/ml/metricas exige autenticación', async () => {
  const res = await peticion('GET', '/api/ml/metricas');
  assert.equal(res.status, 401);
});

test('HU-88: GET /api/ml/metricas/comparacion exige autenticación', async () => {
  const res = await peticion('GET', '/api/ml/metricas/comparacion?base=1&nueva=2');
  assert.equal(res.status, 401);
});
