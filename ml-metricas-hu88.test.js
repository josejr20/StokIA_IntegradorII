// HU-88 — "Evaluar métricas de desempeño del modelo": casos de prueba TC-01 a TC-07 (backend).
// Usa datos simulados y las tablas ml.* en memoria (tests/helpers/mlMemoria.js); no necesita Supabase.
const test = require('node:test');
const assert = require('node:assert/strict');

const servicio = require('../../src/services/mlModeloService');
const controlador = require('../../src/controllers/mlController');
const entrenamiento = require('../../src/services/mlEntrenamientoModelo');
const { AHORA, ventasSimuladas, crearRepositorio } = require('../helpers/mlMemoria');

const { CONFIG_ML } = entrenamiento;
const umbralMinimo = { ...CONFIG_ML, UMBRAL_RMSE_RELATIVO: 0.0001 }; // ningún modelo lo cumple

function respuestaFalsa() {
  const r = { estado: 200, cuerpo: null };
  r.status = (codigo) => { r.estado = codigo; return r; };
  r.json = (cuerpo) => { r.cuerpo = cuerpo; return r; };
  return r;
}

async function conDosVersiones() {
  const repo = crearRepositorio({ ventas: ventasSimuladas() });
  await servicio.entrenarModelo({ ahora: AHORA, repositorio: repo });
  await servicio.entrenarModelo({ ahora: AHORA, repositorio: repo });
  return repo;
}

// ------------------------------------------------------------------------------------------------ TC-01
test('HU-88 TC-01: tras entrenar, la consulta muestra los valores de MAE y RMSE calculados', async () => {
  const repo = crearRepositorio({ ventas: ventasSimuladas() });
  await servicio.entrenarModelo({ ahora: AHORA, repositorio: repo });

  const m = await servicio.obtenerMetricas({ repositorio: repo });
  assert.equal(m.hay_modelo_entrenado, true);
  const v = m.versiones[0];
  assert.equal(v.version, 'v1');
  assert.equal(typeof v.mae, 'number');
  assert.equal(typeof v.rmse, 'number');
  assert.ok(v.mae > 0 && v.rmse >= v.mae); // el RMSE nunca es menor que el MAE
  assert.ok(v.rmse_relativo > 0);
  assert.equal(m.modelo_activo_id, v.id);
});

test('HU-88 TC-01: si todavía no hay modelo entrenado, lo indica sin errores', async () => {
  const m = await servicio.obtenerMetricas({ repositorio: crearRepositorio({ ventas: [] }) });
  assert.equal(m.hay_modelo_entrenado, false);
  assert.deepEqual(m.versiones, []);
  assert.equal(m.mejor_version_id, null);
});

// ------------------------------------------------------------------------------------------------ TC-02
test('HU-88 TC-02: si la evaluación supera el umbral, la versión activa queda marcada "requiere revisión"', async () => {
  const repo = crearRepositorio({ ventas: ventasSimuladas() });
  await servicio.entrenarModelo({ ahora: AHORA, repositorio: repo });
  assert.equal((await servicio.obtenerMetricas({ repositorio: repo })).versiones[0].requiere_revision, false);

  repo.memoria.ventas = ventasSimuladas({ cambio: { ultimosDias: 21, factor: 0.1 } }); // las ventas se desploman
  const r = await servicio.evaluarModeloActivo({ ahora: AHORA, repositorio: repo });

  assert.equal(r.evaluacion.aprobado, false);
  assert.equal(r.modelo.requiere_revision, true);
  assert.equal(repo.memoria.modelos[0].metadata.estado_revision, 'requiere_revision');
  const v = (await servicio.obtenerMetricas({ repositorio: repo })).versiones[0];
  assert.equal(v.requiere_revision, true);
  assert.equal(v.estado, 'activo'); // sigue activa, pero marcada para revisión
});

test('HU-88 TC-02: si el desempeño se recupera, la marca de revisión se quita', async () => {
  const repo = crearRepositorio({ ventas: ventasSimuladas() });
  await servicio.entrenarModelo({ ahora: AHORA, repositorio: repo });
  repo.memoria.ventas = ventasSimuladas({ cambio: { ultimosDias: 21, factor: 0.1 } });
  await servicio.evaluarModeloActivo({ ahora: AHORA, repositorio: repo });
  repo.memoria.ventas = ventasSimuladas(); // vuelve la demanda normal
  const r = await servicio.evaluarModeloActivo({ ahora: AHORA, repositorio: repo });

  assert.equal(r.evaluacion.aprobado, true);
  assert.equal(r.modelo.requiere_revision, false);
  assert.equal(repo.memoria.modelos[0].metadata.estado_revision, 'aprobado');
});

// ------------------------------------------------------------------------------------------------ TC-03
test('HU-88 TC-03: calcula MAE y RMSE tras CADA entrenamiento', async () => {
  const repo = crearRepositorio({ ventas: ventasSimuladas() });
  const a = await servicio.entrenarModelo({ ahora: AHORA, repositorio: repo });
  const b = await servicio.entrenarModelo({ ahora: AHORA, repositorio: repo });

  for (const r of [a, b]) {
    assert.equal(typeof r.modelo.mae, 'number');
    assert.equal(typeof r.modelo.rmse, 'number');
  }
  assert.equal(repo.memoria.modelos.length, 2);
  assert.ok(repo.memoria.modelos.every((m) => m.mae > 0 && m.rmse > 0)); // quedaron guardados en ml.modelos
  const m = await servicio.obtenerMetricas({ repositorio: repo });
  assert.equal(m.versiones[0].mae, b.modelo.mae);
  assert.equal(m.versiones[1].mae, a.modelo.mae);
});

// ------------------------------------------------------------------------------------------------ TC-04
test('HU-88 TC-04: muestra las métricas de forma comprensible (nivel de calidad y explicación)', async () => {
  const repo = crearRepositorio({ ventas: ventasSimuladas() });
  await servicio.entrenarModelo({ ahora: AHORA, repositorio: repo });
  const v = (await servicio.obtenerMetricas({ repositorio: repo })).versiones[0];

  assert.ok(['buena', 'aceptable'].includes(v.calidad));
  assert.match(v.interpretacion, /se equivoca en .* unidades \(MAE\)/);
  assert.match(v.interpretacion, /RMSE es/);
  assert.match(v.interpretacion, /de la demanda semanal promedio/);
  assert.equal(v.cumple_umbral, true);
  assert.ok(v.mae_relativo > 0 && v.mae_relativo <= v.rmse_relativo);
});

test('HU-88 TC-04: los niveles de calidad dependen del umbral', () => {
  assert.equal(servicio.nivelCalidad(0.1, 0.3), 'buena'); // hasta 2/3 del umbral
  assert.equal(servicio.nivelCalidad(0.2, 0.3), 'buena');
  assert.equal(servicio.nivelCalidad(0.25, 0.3), 'aceptable');
  assert.equal(servicio.nivelCalidad(0.3, 0.3), 'aceptable'); // justo en el umbral cumple
  assert.equal(servicio.nivelCalidad(0.31, 0.3), 'requiere_revision');
  assert.equal(servicio.nivelCalidad(null, 0.3), 'sin_datos');
});

// ------------------------------------------------------------------------------------------------ TC-05
test('HU-88 TC-05: compara el desempeño entre versiones (contra la anterior y la mejor)', async () => {
  const repo = await conDosVersiones();
  const m = await servicio.obtenerMetricas({ repositorio: repo });
  const [v2, v1] = m.versiones;

  assert.equal(v1.vs_anterior, null); // la primera no tiene con qué compararse
  assert.equal(v2.vs_anterior.base.version, 'v1');
  assert.equal(v2.vs_anterior.nueva.version, 'v2');
  assert.ok(['mejora', 'empeora', 'igual'].includes(v2.vs_anterior.veredicto));
  assert.equal(v2.vs_anterior.mae.diferencia, Math.round((v2.mae - v1.mae) * 10000) / 10000);
  assert.ok([v1.id, v2.id].includes(m.mejor_version_id));
});

test('HU-88 TC-05: una versión con menor error se reporta como "mejora" y la mejor versión es la de menor error', async () => {
  const repo = crearRepositorio({ ventas: ventasSimuladas() });
  await servicio.entrenarModelo({ ahora: AHORA, repositorio: repo });
  await servicio.entrenarModelo({ ahora: AHORA, repositorio: repo });
  // Se fija a mano el desempeño para controlar el escenario: v1 peor que v2.
  repo.memoria.modelos[0].mae = 10; repo.memoria.modelos[0].rmse = 14; repo.memoria.modelos[0].metadata.rmse_relativo = 0.28;
  repo.memoria.modelos[1].mae = 6; repo.memoria.modelos[1].rmse = 8; repo.memoria.modelos[1].metadata.rmse_relativo = 0.16;

  const m = await servicio.obtenerMetricas({ repositorio: repo });
  const v2 = m.versiones.find((v) => v.version === 'v2');
  assert.equal(v2.vs_anterior.veredicto, 'mejora');
  assert.equal(v2.vs_anterior.mae.tendencia, 'mejora');
  assert.equal(v2.vs_anterior.mae.porcentaje, -40);
  assert.equal(m.mejor_version_id, v2.id);

  const inversa = await servicio.compararVersiones(repo.memoria.modelos[1].id, repo.memoria.modelos[0].id, { repositorio: repo });
  assert.equal(inversa.veredicto, 'empeora');
});

test('HU-88 TC-05: compararVersiones valida las versiones elegidas', async () => {
  const repo = await conDosVersiones();
  await assert.rejects(() => servicio.compararVersiones(1, 1, { repositorio: repo }), (e) => e.estadoHttp === 400);
  await assert.rejects(() => servicio.compararVersiones(1, 99, { repositorio: repo }), (e) => e.estadoHttp === 404);
  const ok = await servicio.compararVersiones(1, 2, { repositorio: repo });
  assert.equal(ok.base.version, 'v1');
  assert.equal(ok.nueva.version, 'v2');
});

// ------------------------------------------------------------------------------------------------ TC-06
test('HU-88 TC-06: marca la versión cuyo error supera el umbral y no la activa', async () => {
  const repo = crearRepositorio({ ventas: ventasSimuladas() });
  const r = await servicio.entrenarModelo({ ahora: AHORA, repositorio: repo, config: umbralMinimo });

  assert.equal(r.activado, false);
  assert.equal(r.modelo.requiere_revision, true);
  const v = (await servicio.obtenerMetricas({ repositorio: repo })).versiones[0];
  assert.equal(v.requiere_revision, true);
  assert.equal(v.cumple_umbral, false);
  assert.equal(v.calidad, 'requiere_revision');
  assert.equal(v.estado, 'requiere_revision');
});

test('HU-88 TC-06: una versión que cumple el umbral NO se marca', async () => {
  const repo = crearRepositorio({ ventas: ventasSimuladas() });
  const r = await servicio.entrenarModelo({ ahora: AHORA, repositorio: repo });
  assert.equal(r.modelo.requiere_revision, false);
});

// ------------------------------------------------------------------------------------------------ TC-07
test('HU-88 TC-07: registra el historial de métricas por versión (entrenamiento + cada evaluación)', async () => {
  const repo = crearRepositorio({ ventas: ventasSimuladas() });
  await servicio.entrenarModelo({ ahora: AHORA, repositorio: repo });
  await servicio.evaluarModeloActivo({ ahora: AHORA, repositorio: repo });
  repo.memoria.ventas = ventasSimuladas({ cambio: { ultimosDias: 21, factor: 0.1 } });
  await servicio.evaluarModeloActivo({ ahora: AHORA, repositorio: repo });

  const v = (await servicio.obtenerMetricas({ repositorio: repo })).versiones[0];
  assert.equal(v.historial_evaluaciones.length, 2); // la segunda no pisó a la primera
  assert.equal(v.historial_evaluaciones[0].aprobado, true);
  assert.equal(v.historial_evaluaciones[1].aprobado, false);
  assert.equal(v.ultima_evaluacion.aprobado, false);
  assert.ok(v.historial_evaluaciones.every((e) => typeof e.mae === 'number' && typeof e.rmse === 'number'));
});

test('HU-88 TC-07: el historial de evaluaciones guarda solo las últimas 30', async () => {
  const repo = crearRepositorio({ ventas: ventasSimuladas() });
  await servicio.entrenarModelo({ ahora: AHORA, repositorio: repo });
  for (let i = 0; i < 33; i += 1) await servicio.evaluarModeloActivo({ ahora: AHORA, repositorio: repo });
  const v = (await servicio.obtenerMetricas({ repositorio: repo })).versiones[0];
  assert.equal(v.historial_evaluaciones.length, 30);
});

test('HU-88 TC-07: el historial por versión se conserva al entrenar nuevas versiones', async () => {
  const repo = await conDosVersiones();
  const m = await servicio.obtenerMetricas({ repositorio: repo });
  assert.deepEqual(m.versiones.map((v) => v.version), ['v2', 'v1']);
  assert.ok(m.versiones.every((v) => v.mae > 0 && v.fecha_entrenamiento));
});

// ------------------------------------------------------------------------------------------------ endpoints
test('HU-88: GET /metricas responde 200 y GET /metricas/comparacion valida los parámetros', async () => {
  const repo = await conDosVersiones();
  const originalMetricas = servicio.obtenerMetricas;
  const originalComparar = servicio.compararVersiones;
  servicio.obtenerMetricas = (o) => originalMetricas({ ...o, repositorio: repo });
  servicio.compararVersiones = (a, b, o) => originalComparar(a, b, { ...o, repositorio: repo });
  try {
    let res = respuestaFalsa();
    await controlador.metricas({}, res, (e) => { throw e; });
    assert.equal(res.estado, 200);
    assert.equal(res.cuerpo.data.versiones.length, 2);

    res = respuestaFalsa();
    await controlador.comparar({ query: { base: '1', nueva: '2' } }, res, (e) => { throw e; });
    assert.equal(res.estado, 200);
    assert.equal(res.cuerpo.data.nueva.version, 'v2');

    res = respuestaFalsa();
    await controlador.comparar({ query: { base: '1' } }, res, (e) => { throw e; });
    assert.equal(res.estado, 400);

    res = respuestaFalsa();
    await controlador.comparar({ query: { base: '1', nueva: '1' } }, res, (e) => { throw e; });
    assert.equal(res.estado, 400);

    res = respuestaFalsa();
    await controlador.comparar({ query: { base: '1', nueva: '77' } }, res, (e) => { throw e; });
    assert.equal(res.estado, 404);
  } finally {
    servicio.obtenerMetricas = originalMetricas;
    servicio.compararVersiones = originalComparar;
  }
});
