// HU-82 — "Entrenar modelo de predicción de demanda": casos de prueba TC-01 a TC-07 (backend).
// Usa datos simulados y las tablas ml.* en memoria (tests/helpers/mlMemoria.js); no necesita conexión a Supabase.
const test = require('node:test');
const assert = require('node:assert/strict');

const servicio = require('../../src/services/mlModeloService');
const controlador = require('../../src/controllers/mlController');
const auditoria = require('../../src/middleware/auditoria');
const repositorioReal = require('../../src/services/mlModeloRepositorio');
const { AHORA, ventasSimuladas, crearRepositorio } = require('../helpers/mlMemoria');

// Reloj falso: devuelve una lista de instantes (ms) en orden, para fijar la duración del entrenamiento.
const relojFijo = (...instantes) => {
  const cola = [...instantes];
  return () => (cola.length > 1 ? cola.shift() : cola[0]);
};
const T0 = Date.parse('2026-10-23T15:00:00Z');

/** Respuesta HTTP falsa para probar el controlador sin levantar Express. */
function respuestaFalsa() {
  const r = { estado: null, cuerpo: null };
  r.status = (codigo) => { r.estado = codigo; return r; };
  r.json = (cuerpo) => { r.cuerpo = cuerpo; return r; };
  return r;
}

// ------------------------------------------------------------------------------------------------ TC-01
test('HU-82 TC-01: entrenamiento exitoso genera el modelo y guarda su versión', async () => {
  const repo = crearRepositorio({ ventas: ventasSimuladas() });
  const r = await servicio.entrenarModelo({ ahora: AHORA, repositorio: repo });

  assert.equal(r.modelo.version, 'v1');
  assert.equal(r.activado, true);
  assert.equal(repo.memoria.modelos.length, 1); // la versión quedó guardada en ml.modelos
  assert.equal(repo.memoria.modelos[0].activo, true);
  assert.ok(r.modelo.parametros.alpha > 0);
  assert.ok(r.modelo.rmse_relativo !== null && r.modelo.mae !== null);
});

// ------------------------------------------------------------------------------------------------ TC-02
test('HU-82 TC-02: sin datos suficientes responde 422, indica que no es posible entrenar y no crea versión', async () => {
  const repo = crearRepositorio({ ventas: ventasSimuladas({ productos: 1, dias: 9 }) }); // < 50 filas
  await assert.rejects(
    () => servicio.entrenarModelo({ ahora: AHORA, repositorio: repo }),
    (e) => e.codigo === 'datos_insuficientes'
      && e.estadoHttp === 422
      && /No es posible entrenar el modelo con la información disponible/.test(e.message),
  );
  assert.equal(repo.memoria.modelos.length, 0);
});

// ------------------------------------------------------------------------------------------------ TC-03
test('HU-82 TC-03: usa los datos históricos preparados (descarta filas inválidas y registra el resumen)', async () => {
  const buenas = ventasSimuladas();
  const sucias = [
    ...buenas,
    { producto_id: 1, cantidad: '-4', fecha_venta: '2026-10-10T12:00:00-05:00' }, // cantidad inválida
    { producto_id: 1, cantidad: 'abc', fecha_venta: '2026-10-11T12:00:00-05:00' }, // cantidad inválida
    { producto_id: 1, cantidad: '0', fecha_venta: '2026-10-12T12:00:00-05:00' }, // cantidad cero: no es una venta
  ];
  const repo = crearRepositorio({ ventas: sucias });
  const r = await servicio.entrenarModelo({ ahora: AHORA, repositorio: repo });

  assert.equal(r.datos_preparados.total_filas, sucias.length);
  assert.equal(r.datos_preparados.filas_validas, buenas.length);
  assert.equal(r.datos_preparados.filas_descartadas, 3);
  assert.equal(r.datos_preparados.motivos_descarte.cantidad_invalida, 3);
  assert.equal(repo.memoria.modelos[0].filas_entrenamiento, buenas.length); // entrenó solo con las válidas
  assert.equal(repo.memoria.preparaciones[0].listo_para_entrenar, true);
});

// ------------------------------------------------------------------------------------------------ TC-04
test('HU-82 TC-04: cada entrenamiento genera una NUEVA versión y conserva las anteriores', async () => {
  const repo = crearRepositorio({ ventas: ventasSimuladas() });
  const primera = await servicio.entrenarModelo({ ahora: AHORA, repositorio: repo });
  const segunda = await servicio.entrenarModelo({ ahora: AHORA, repositorio: repo });

  assert.equal(primera.modelo.version, 'v1');
  assert.equal(segunda.modelo.version, 'v2');
  assert.equal(repo.memoria.modelos.length, 2); // la v1 sigue guardada
  assert.equal(repo.memoria.modelos.filter((m) => m.activo).length, 1); // solo una activa
  const { versiones } = await servicio.listar({ repositorio: repo });
  assert.deepEqual(versiones.map((v) => v.version), ['v2', 'v1']);
});

// ------------------------------------------------------------------------------------------------ TC-05
test('HU-82 TC-05: registra la fecha y la duración del entrenamiento (en la versión y en la bitácora)', async () => {
  const repo = crearRepositorio({ ventas: ventasSimuladas() });
  const r = await servicio.entrenarModelo({ ahora: AHORA, repositorio: repo, reloj: relojFijo(T0, T0 + 2500) });

  assert.equal(r.entrenamiento.duracion_ms, 2500);
  assert.equal(r.entrenamiento.duracion_texto, '2,5 s');
  assert.equal(r.entrenamiento.iniciado_en, new Date(T0).toISOString());
  assert.equal(r.entrenamiento.finalizado_en, new Date(T0 + 2500).toISOString());
  assert.ok(r.modelo.fecha_entrenamiento); // fecha de creación de la versión
  assert.equal(r.modelo.entrenamiento.duracion_ms, 2500);

  const fila = repo.memoria.entrenamientos[0]; // bitácora ml.entrenamientos_log
  assert.equal(fila.duracion_ms, 2500);
  assert.equal(fila.iniciado_en, new Date(T0).toISOString());
  assert.equal(fila.finalizado_en, new Date(T0 + 2500).toISOString());
  assert.match(fila.mensaje, /Duración del entrenamiento: 2,5 s/);
  assert.equal(repo.memoria.modelos[0].metadata.entrenamiento.duracion_ms, 2500);
});

test('HU-82 TC-05: el intento que falla por falta de datos también queda con su fecha y duración', async () => {
  const repo = crearRepositorio({ ventas: ventasSimuladas({ productos: 1, dias: 9 }) });
  await assert.rejects(
    () => servicio.entrenarModelo({ ahora: AHORA, repositorio: repo, reloj: relojFijo(T0, T0 + 400) }),
    (e) => e.detalle.duracion_ms === 400 && e.detalle.duracion_texto === '400 ms',
  );
  const fila = repo.memoria.entrenamientos[0];
  assert.equal(fila.resultado, 'insuficiente_datos');
  assert.equal(fila.duracion_ms, 400);
  assert.equal(fila.iniciado_en, new Date(T0).toISOString());
});

test('HU-82 TC-05: la duración se muestra en formato legible', () => {
  assert.equal(servicio.duracionTexto(850), '850 ms');
  assert.equal(servicio.duracionTexto(1400), '1,4 s');
  assert.equal(servicio.duracionTexto(125000), '2 min 5 s');
  assert.equal(servicio.duracionTexto(null), null);
});

// ------------------------------------------------------------------------------------------------ TC-06
test('HU-82 TC-06: indica que faltan datos por filas insuficientes, con el detalle numérico', async () => {
  const repo = crearRepositorio({ ventas: ventasSimuladas({ productos: 1, dias: 9 }), minimoFilas: 50 });
  await assert.rejects(
    () => servicio.entrenarModelo({ ahora: AHORA, repositorio: repo }),
    (e) => {
      assert.equal(e.codigo, 'datos_insuficientes');
      assert.equal(e.detalle.minimo_filas, 50);
      assert.ok(e.detalle.filas_validas < 50);
      assert.match(e.message, /necesitan al menos 50/);
      return true;
    },
  );
  assert.equal(repo.memoria.preparaciones[0].listo_para_entrenar, false);
  assert.equal(repo.memoria.entrenamientos[0].promovido, false);
});

test('HU-82 TC-06: indica que faltan datos aunque haya filas, si el historial es demasiado corto para evaluar', async () => {
  // 8 productos × 10 días = 80 filas (supera el mínimo de filas) pero ningún producto tiene historial suficiente
  const repo = crearRepositorio({ ventas: ventasSimuladas({ productos: 8, dias: 10 }) });
  await assert.rejects(
    () => servicio.entrenarModelo({ ahora: AHORA, repositorio: repo }),
    (e) => e.codigo === 'datos_insuficientes'
      && e.detalle.filas_validas >= 50
      && e.detalle.pruebas_necesarias === 10
      && e.detalle.pruebas_logradas < 10,
  );
  assert.equal(repo.memoria.modelos.length, 0);
});

// ------------------------------------------------------------------------------------------------ TC-07
test('HU-82 TC-07: confirma el entrenamiento exitoso al administrador (servicio)', async () => {
  const repo = crearRepositorio({ ventas: ventasSimuladas() });
  const r = await servicio.entrenarModelo({ ahora: AHORA, repositorio: repo, reloj: relojFijo(T0, T0 + 1200) });
  assert.match(r.mensaje, /^Modelo v1 entrenado y activado/);
  assert.match(r.mensaje, /Duración del entrenamiento: 1,2 s/);
  assert.equal(r.aviso, null);
});

test('HU-82 TC-07: el endpoint responde 201 con la confirmación y deja constancia en la auditoría', async () => {
  const repo = crearRepositorio({ ventas: ventasSimuladas() });
  const original = servicio.entrenarModelo;
  const auditoriaOriginal = auditoria.crearAuditoria;
  const llamadas = [];
  servicio.entrenarModelo = (opciones) => original({ ...opciones, ahora: AHORA, repositorio: repo });
  auditoria.crearAuditoria = async (...args) => { llamadas.push(args); };
  try {
    const res = respuestaFalsa();
    await controlador.entrenar({ user: { id: 7 } }, res, (error) => { throw error; });

    assert.equal(res.estado, 201);
    assert.match(res.cuerpo.data.mensaje, /entrenado y activado/);
    assert.ok(res.cuerpo.data.entrenamiento.duracion_ms >= 0);
    assert.equal(res.cuerpo.data.modelo.version, 'v1');
    assert.equal(llamadas.length, 1);
    assert.deepEqual(llamadas[0].slice(0, 3), [7, 'entrenar_modelo_ml', 'ml_modelos']);
    assert.equal(llamadas[0][4].version, 'v1');
  } finally {
    servicio.entrenarModelo = original;
    auditoria.crearAuditoria = auditoriaOriginal;
  }
});

test('HU-82 TC-02/TC-06: el endpoint responde 422 con el motivo y el detalle cuando faltan datos', async () => {
  const repo = crearRepositorio({ ventas: ventasSimuladas({ productos: 1, dias: 9 }) });
  const original = servicio.entrenarModelo;
  const auditoriaOriginal = auditoria.crearAuditoria;
  const llamadas = [];
  servicio.entrenarModelo = (opciones) => original({ ...opciones, ahora: AHORA, repositorio: repo });
  auditoria.crearAuditoria = async (...args) => { llamadas.push(args); };
  try {
    const res = respuestaFalsa();
    await controlador.entrenar({ user: { id: 7 } }, res, (error) => { throw error; });

    assert.equal(res.estado, 422);
    assert.equal(res.cuerpo.codigo, 'datos_insuficientes');
    assert.match(res.cuerpo.error, /No es posible entrenar/);
    assert.ok(res.cuerpo.detalle.minimo_filas > res.cuerpo.detalle.filas_validas);
    assert.equal(llamadas[0][1], 'entrenar_modelo_ml_sin_datos');
  } finally {
    servicio.entrenarModelo = original;
    auditoria.crearAuditoria = auditoriaOriginal;
  }
});

test('HU-82: si falla la auditoría, el entrenamiento igual se confirma', async () => {
  const repo = crearRepositorio({ ventas: ventasSimuladas() });
  const original = servicio.entrenarModelo;
  const auditoriaOriginal = auditoria.crearAuditoria;
  servicio.entrenarModelo = (opciones) => original({ ...opciones, ahora: AHORA, repositorio: repo });
  auditoria.crearAuditoria = async () => { throw new Error('tabla auditoria caída'); };
  try {
    const res = respuestaFalsa();
    await controlador.entrenar({ user: { id: 7 } }, res, (error) => { throw error; });
    assert.equal(res.estado, 201);
  } finally {
    servicio.entrenarModelo = original;
    auditoria.crearAuditoria = auditoriaOriginal;
  }
});

// ------------------------------------------------------------------------------------------------ historial
test('HU-82 TC-05: la pantalla recibe el historial de entrenamientos con fecha y duración (incluye los fallidos)', async () => {
  const repo = crearRepositorio({ ventas: ventasSimuladas({ productos: 1, dias: 9 }) });
  await assert.rejects(() => servicio.entrenarModelo({ ahora: AHORA, repositorio: repo, reloj: relojFijo(T0, T0 + 300) }));
  repo.memoria.ventas = ventasSimuladas();
  await servicio.entrenarModelo({ ahora: AHORA, repositorio: repo, reloj: relojFijo(T0 + 5000, T0 + 7000) });

  const estado = await servicio.listar({ repositorio: repo });
  assert.equal(estado.entrenamientos.length, 2);
  assert.deepEqual(estado.entrenamientos.map((e) => [e.resultado, e.duracion_texto]), [['exitoso', '2 s'], ['insuficiente_datos', '300 ms']]);
  assert.equal(estado.ultimo_entrenamiento.resultado, 'exitoso');
  assert.equal(estado.modelo_activo.entrenamiento.duracion_ms, 2000);
});

// ------------------------------------------------------------------------------------------------ compatibilidad con la BD
test('HU-82: si ml.entrenamientos_log aún no tiene las columnas de duración, guarda el registro sin ellas', async () => {
  const { sequelize } = require('../../src/models');
  const consultaOriginal = sequelize.query;
  const sentencias = [];
  sequelize.query = async (sql) => {
    sentencias.push(sql);
    if (/duracion_ms/.test(sql)) throw Object.assign(new Error('column "duracion_ms" does not exist'), { parent: { code: '42703' } });
    return [];
  };
  try {
    await repositorioReal.registrarEntrenamiento({
      modeloId: 1, disparadoPor: 'manual', resultado: 'exitoso', promovido: true, mensaje: 'ok', duracionMs: 10, iniciadoEn: 'a', finalizadoEn: 'b',
    });
    assert.equal(sentencias.length, 2);
    assert.ok(!/duracion_ms/.test(sentencias[1]));

    // otro tipo de error NO se disfraza
    sequelize.query = async () => { throw Object.assign(new Error('sin permiso'), { parent: { code: '42501' } }); };
    await assert.rejects(
      () => repositorioReal.registrarEntrenamiento({ disparadoPor: 'manual', resultado: 'exitoso', promovido: true, mensaje: 'ok' }),
      /sin permiso/,
    );
  } finally {
    sequelize.query = consultaOriginal;
  }
});
