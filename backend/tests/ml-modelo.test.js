// HU-78 — Casos de prueba de "Modelo de Machine Learning: entrenamiento y evaluación" (TC-01 a TC-07).
// Usa datos simulados y un registro de versiones en memoria con la misma forma que las tablas ml.* del equipo.
const test = require('node:test');
const assert = require('node:assert/strict');

const demanda = require('../src/services/prediccionDemandaModelo');
const entrenamiento = require('../src/services/mlEntrenamientoModelo');
const servicio = require('../src/services/mlModeloService');
const { ALGORITMO } = require('../src/services/mlModeloRepositorio');
const { predecirProductos } = require('../src/services/prediccionDemandaService');
const { leerId } = require('../src/controllers/mlController');

const { CONFIG_ML } = entrenamiento;
const AHORA = new Date('2026-10-23T10:00:00-05:00'); // el último día completo es el 22/oct
const HASTA = '2026-10-22';
const dias = (n) => n * 24 * 60 * 60 * 1000;

// ---- datos simulados (deterministas)
function generador(semilla) {
  let valor = semilla;
  const aleatorio = () => {
    valor = (valor * 1664525 + 1013904223) % 4294967296;
    return valor / 4294967296;
  };
  const gauss = () => Math.sqrt(-2 * Math.log(aleatorio() + 1e-12)) * Math.cos(2 * Math.PI * aleatorio());
  return { aleatorio, gauss };
}

const PATRON_SEMANAL = [0.5, 0.95, 1, 1.05, 1.1, 1.4, 1.5]; // domingo ... sábado

function ventasSimuladas({ productos = 12, dias: cantidadDias = 84, hasta = HASTA, ruido = 0.2, semilla = 7, cambio = null } = {}) {
  const { aleatorio, gauss } = generador(semilla);
  const ventas = [];
  for (let producto = 1; producto <= productos; producto += 1) {
    const base = 5 + aleatorio() * 35;
    for (let i = cantidadDias - 1; i >= 0; i -= 1) {
      const fecha = demanda.sumarDias(hasta, -i);
      let media = base * PATRON_SEMANAL[demanda.diaSemana(fecha)];
      if (cambio && i < cambio.ultimosDias) media *= cambio.factor; // cambio brusco de demanda
      const cantidad = Math.max(0, Math.round(media + gauss() * media * ruido));
      if (cantidad > 0) ventas.push({ producto_id: producto, cantidad: String(cantidad), fecha_venta: `${fecha}T12:00:00-05:00` });
    }
  }
  return ventas;
}

// ---- tablas ml.* en memoria (mismas reglas que mlModeloRepositorio)
function crearRepositorio({ ventas = [], minimoFilas = 50 } = {}) {
  const memoria = { modelos: [], entrenamientos: [], preparaciones: [], ventas, reloj: 0 };
  const reloj = () => new Date(Date.parse('2026-10-23T15:00:00Z') + (memoria.reloj += 1000));
  const copiar = (valor) => (valor ? structuredClone(valor) : null);
  const nuestros = () => memoria.modelos.filter((modelo) => modelo.algoritmo === ALGORITMO);
  return {
    memoria,
    obtenerModeloActivo: async () => {
      const activo = nuestros().filter((m) => m.activo).sort((a, b) => b.version - a.version)[0];
      return activo ? { ...copiar(activo), parametros: activo.metadata.parametros ?? null } : null;
    },
    obtenerModelo: async (id) => copiar(memoria.modelos.find((modelo) => modelo.id === id)),
    listarModelos: async () => nuestros().sort((a, b) => b.version - a.version).map(copiar),
    registrarModelo: async ({ metadata, mae, rmse, filas_entrenamiento: filas, notas, activar }) => {
      const version = Math.max(0, ...memoria.modelos.map((m) => m.version)) + 1; // el mayor de TODA la tabla + 1
      if (activar) nuestros().forEach((m) => { m.activo = false; });
      const modelo = {
        id: memoria.modelos.length + 1, version, algoritmo: ALGORITMO, activo: activar === true, mae, rmse,
        filas_entrenamiento: filas, ruta_artefacto: 'metadata:parametros', metadata: structuredClone(metadata),
        fecha_creacion: reloj(), notas,
      };
      memoria.modelos.push(modelo);
      return copiar(modelo);
    },
    activarModelo: async (id, parche) => {
      nuestros().forEach((m) => { m.activo = false; });
      const modelo = memoria.modelos.find((m) => m.id === id);
      modelo.activo = true;
      modelo.metadata = { ...modelo.metadata, ...parche };
      return copiar(modelo);
    },
    actualizarMetadata: async (id, parche) => {
      const modelo = memoria.modelos.find((m) => m.id === id);
      modelo.metadata = { ...modelo.metadata, ...parche };
    },
    registrarEntrenamiento: async ({ modeloId = null, disparadoPor, resultado, promovido, mensaje }) => {
      memoria.entrenamientos.push({ id: memoria.entrenamientos.length + 1, modelo_id: modeloId, disparado_por: disparadoPor, resultado, promovido, mensaje, fecha: reloj() });
    },
    listarEntrenamientos: async (limite) => [...memoria.entrenamientos].reverse().slice(0, limite).map(copiar),
    registrarPreparacion: async (datos) => { memoria.preparaciones.push(copiar(datos)); },
    minimoFilasEntrenamiento: async () => minimoFilas,
    ventas: async (desde, hastaExclusivo) =>
      memoria.ventas.filter((venta) => {
        const fecha = new Date(venta.fecha_venta);
        return fecha >= desde && fecha < hastaExclusivo;
      }),
  };
}

const umbralMinimo = { ...CONFIG_ML, UMBRAL_RMSE_RELATIVO: 0.0001 }; // ningún modelo lo cumple
const soloMalosParametros = { ...CONFIG_ML, GRILLA: { alpha: [0.3], beta: [0.05], phi: [0.98] } }; // fuerza un candidato peor

// ---------------------------------------------------------------- ML-02 / TC-04: métricas

test('TC-04: calcula MAE, RMSE y RMSE relativo a la demanda promedio', () => {
  const m = entrenamiento.calcularMetricas([
    { predicho: 10, real: 12 }, { predicho: 20, real: 17 }, { predicho: 30, real: 30 }, { predicho: 5, real: 7 },
  ]);
  assert.equal(m.evaluaciones, 4);
  assert.equal(m.mae, 1.75); // (2 + 3 + 0 + 2) / 4
  assert.equal(m.rmse, 2.06); // raíz de (4 + 9 + 0 + 4) / 4
  assert.equal(m.demanda_promedio, 16.5); // (12 + 17 + 30 + 7) / 4
  assert.equal(m.rmse_relativo, 0.1249); // 2.0616 / 16.5
  assert.equal(entrenamiento.calcularMetricas([]).rmse_relativo, null);
  assert.equal(entrenamiento.calcularMetricas([{ predicho: 1, real: 0 }]).rmse_relativo, null); // sin demanda real
});

test('el cálculo rápido del entrenamiento da el mismo total que el pronóstico completo de HU-72', () => {
  const { aleatorio } = generador(3);
  for (let k = 0; k < 25; k += 1) {
    const ventas = [];
    for (let i = 0; i < 20 + Math.floor(aleatorio() * 60); i += 1) {
      if (aleatorio() < 0.2) continue;
      ventas.push({ fecha_venta: `${demanda.sumarDias(HASTA, -i)}T12:00:00-05:00`, cantidad: String(1 + Math.floor(aleatorio() * 30)) });
    }
    const { serie } = demanda.construirSerie(ventas, HASTA);
    if (serie.length < 14) continue;
    const parametros = demanda.normalizarParametros({ alpha: 0.2, beta: 0.03, phi: 0.8 });
    const lento = demanda.pronosticarSerie(serie, 7, HASTA, parametros).reduce((suma, dia) => suma + dia.cantidad, 0);
    assert.equal(demanda.pronosticarTotal(serie, 7, HASTA, parametros), lento);
  }
});

// ---------------------------------------------------------------- ML-01 / TC-03: datos preparados y entrenamiento

test('TC-03: resume los datos preparados (filas válidas y motivos de descarte)', () => {
  const r = entrenamiento.resumirPreparacion([
    { cantidad: '5', fecha_venta: '2026-10-01T12:00:00-05:00' },
    { cantidad: '0', fecha_venta: '2026-10-02T12:00:00-05:00' },
    { cantidad: 'abc', fecha_venta: '2026-10-03T12:00:00-05:00' },
    { cantidad: '3', fecha_venta: 'no es fecha' },
    { cantidad: '2.5', fecha_venta: '2026-10-04T12:00:00-05:00' },
  ]);
  assert.deepEqual(r, { total_filas: 5, filas_validas: 2, filas_descartadas: 3, motivos_descarte: { cantidad_invalida: 2, fecha_invalida: 1 } });
});

test('TC-03: entrena con el historial de ventas y elige los parámetros con menor error', () => {
  const r = entrenamiento.entrenar(ventasSimuladas(), { hasta: HASTA });
  assert.equal(r.ok, true);
  assert.ok(entrenamiento.candidatos().some((c) => c.alpha === r.parametros.alpha && c.beta === r.parametros.beta && c.phi === r.parametros.phi));
  assert.equal(r.candidatos_probados, 60);
  assert.equal(r.validacion, 'independiente'); // mide con datos que no usó para elegir
  assert.ok(r.pruebas.para_medir >= CONFIG_ML.MIN_EVALUACIONES && r.pruebas.para_elegir >= CONFIG_ML.MIN_EVALUACIONES);
  assert.ok(r.metricas.rmse_relativo > 0 && r.metricas.rmse_relativo <= CONFIG_ML.UMBRAL_RMSE_RELATIVO);
  assert.equal(r.aprobado, true);
  assert.equal(r.productos_evaluados, 12);
  assert.equal(r.actual, null); // sin modelo activo no hay con qué comparar
  assert.ok(r.metricas.rmse_relativo <= r.referencia.rmse_relativo * 1.1);
});

test('compara con el modelo activo sobre las MISMAS pruebas cuando se le indican sus parámetros', () => {
  const r = entrenamiento.entrenar(ventasSimuladas(), { hasta: HASTA, parametrosActivos: { alpha: 0.3, beta: 0.05, phi: 0.98 } });
  assert.equal(r.ok, true);
  assert.equal(r.actual.evaluaciones, r.metricas.evaluaciones);
  assert.ok(r.actual.rmse_relativo > 0);
});

test('TC-03: sin historial suficiente no entrena e informa el motivo', () => {
  const r = entrenamiento.entrenar(ventasSimuladas({ productos: 2, dias: 10 }), { hasta: HASTA });
  assert.equal(r.ok, false);
  assert.equal(r.motivo, 'datos_insuficientes');
  assert.match(r.mensaje, /No hay datos históricos suficientes/);
});

test('con poco historial usa los mismos datos para elegir y medir y lo advierte', async () => {
  const ventas = ventasSimuladas({ dias: 30 });
  const r = entrenamiento.entrenar(ventas, { hasta: HASTA });
  assert.equal(r.ok, true);
  assert.equal(r.validacion, 'mismos_datos');

  const resultado = await servicio.entrenarModelo({ ahora: AHORA, repositorio: crearRepositorio({ ventas }) });
  assert.match(resultado.mensaje, /las métricas pueden ser optimistas/);
});

// ---------------------------------------------------------------- regla de promoción

test('promoción: debe cumplir el umbral y no empeorar al modelo activo', () => {
  const bueno = { rmse_relativo: 0.15 };
  assert.deepEqual(servicio.decidirPromocion({ aprobado: false, nuevo: { rmse_relativo: 0.5 }, actual: null }),
    { promover: false, resultado: 'exitoso', estadoRevision: 'requiere_revision' });
  assert.equal(servicio.decidirPromocion({ aprobado: true, nuevo: bueno, actual: null }).promover, true);
  assert.equal(servicio.decidirPromocion({ aprobado: true, nuevo: bueno, actual: { rmse_relativo: 0.2 } }).promover, true); // mejora
  assert.equal(servicio.decidirPromocion({ aprobado: true, nuevo: bueno, actual: { rmse_relativo: 0.15 } }).promover, true); // empate
  assert.deepEqual(servicio.decidirPromocion({ aprobado: true, nuevo: bueno, actual: { rmse_relativo: 0.1 } }),
    { promover: false, resultado: 'sin_mejora', estadoRevision: 'sin_mejora' });
});

// ---------------------------------------------------------------- TC-01 / TC-06 / TC-05: versiones y reentrenamiento

test('TC-01 y TC-06: el entrenamiento registra una versión con su fecha y sus métricas', async () => {
  const repo = crearRepositorio({ ventas: ventasSimuladas() });
  const r = await servicio.entrenarModelo({ ahora: AHORA, repositorio: repo });

  assert.equal(r.activado, true);
  assert.equal(r.modelo.version, 'v1');
  assert.equal(r.modelo.estado, 'activo');
  assert.ok(r.modelo.fecha_entrenamiento);
  assert.ok(r.modelo.parametros.alpha > 0);
  for (const campo of ['mae', 'rmse', 'rmse_relativo', 'evaluaciones']) assert.ok(r.modelo[campo] !== null, campo);
  assert.match(r.mensaje, /^Modelo v1 entrenado y activado/);

  const fila = repo.memoria.modelos[0]; // lo que queda en ml.modelos
  assert.equal(fila.algoritmo, ALGORITMO);
  assert.equal(fila.activo, true);
  assert.ok(fila.mae > 0 && fila.rmse >= fila.mae && fila.filas_entrenamiento > 0);
  assert.ok(fila.ruta_artefacto && fila.notas);

  assert.deepEqual(
    (({ modelo_id, disparado_por, resultado, promovido }) => ({ modelo_id, disparado_por, resultado, promovido }))(repo.memoria.entrenamientos[0]),
    { modelo_id: 1, disparado_por: 'manual', resultado: 'exitoso', promovido: true },
  );
  assert.equal(repo.memoria.preparaciones[0].listo_para_entrenar, true); // datos preparados registrados
});

test('TC-05 y TC-06: reentrenar con ventas nuevas crea una versión nueva y conserva la anterior', async () => {
  const repo = crearRepositorio({ ventas: ventasSimuladas() });
  await servicio.entrenarModelo({ ahora: AHORA, repositorio: repo });
  repo.memoria.modelos[0].metadata.parametros = { alpha: 0.3, beta: 0.05, phi: 0.98 }; // el modelo activo pasa a ser uno mediocre

  // pasan 7 días y entran ventas nuevas
  repo.memoria.ventas = ventasSimuladas({ hasta: demanda.sumarDias(HASTA, 7), semilla: 11 });
  const r = await servicio.entrenarModelo({ ahora: new Date(AHORA.getTime() + dias(7)), repositorio: repo });

  assert.equal(r.modelo.version, 'v2');
  assert.equal(r.activado, true);
  assert.equal(r.modelo.datos.hasta, demanda.sumarDias(HASTA, 7)); // usó los datos nuevos
  const versiones = (await servicio.listar({ repositorio: repo })).versiones;
  assert.deepEqual(versiones.map((v) => [v.version, v.estado]), [['v2', 'activo'], ['v1', 'archivado']]);
  assert.equal(repo.memoria.modelos.filter((m) => m.activo).length, 1);
  assert.equal(repo.memoria.entrenamientos.length, 2);
});

test('si el modelo nuevo cumple el umbral pero no mejora al activo, se guarda sin promoverlo (sin_mejora)', async () => {
  const repo = crearRepositorio({ ventas: ventasSimuladas() });
  await servicio.entrenarModelo({ ahora: AHORA, repositorio: repo }); // v1 con los mejores parámetros

  const r = await servicio.entrenarModelo({ ahora: AHORA, repositorio: repo, config: soloMalosParametros });

  assert.equal(r.activado, false);
  assert.equal(r.modelo.version, 'v2');
  assert.equal(r.modelo.estado, 'archivado');
  assert.equal(r.aviso, null); // no requiere revisión: simplemente no mejora
  assert.match(r.mensaje, /no mejora al modelo activo/);
  assert.equal(repo.memoria.entrenamientos[1].resultado, 'sin_mejora');
  assert.equal(repo.memoria.entrenamientos[1].promovido, false);
  assert.equal((await repo.obtenerModeloActivo()).version, 1);
});

test('convive con modelos de otros algoritmos del equipo: no los desactiva y no repite su numeración', async () => {
  const repo = crearRepositorio({ ventas: ventasSimuladas() });
  repo.memoria.modelos.push({ id: 50, version: 12, algoritmo: 'random_forest', activo: true, mae: 1, rmse: 2, filas_entrenamiento: 100, ruta_artefacto: 'modelos/rf.pkl', metadata: {}, fecha_creacion: new Date(), notas: null });

  const r = await servicio.entrenarModelo({ ahora: AHORA, repositorio: repo });
  assert.equal(r.modelo.version, 'v13'); // continúa la numeración de la tabla
  assert.equal(repo.memoria.modelos.find((m) => m.id === 50).activo, true); // el de ellos sigue activo

  await assert.rejects(() => servicio.activarVersion(50, { repositorio: repo }), (e) => e.estadoHttp === 404); // no es nuestro
  assert.equal(repo.memoria.modelos.find((m) => m.id === 50).activo, true);
  assert.deepEqual((await servicio.listar({ repositorio: repo })).versiones.map((v) => v.version), ['v13']); // solo vemos los nuestros
});

test('la predicción de demanda (HU-72) usa los parámetros y la versión del modelo activo', async () => {
  const repo = crearRepositorio({ ventas: ventasSimuladas() });
  const { modelo } = await servicio.entrenarModelo({ ahora: AHORA, repositorio: repo });

  const repoPrediccion = (version) => ({
    productos: async (ids) => ids.map((id) => ({ id, codigo: `P-${id}`, nombre: `Producto ${id}`, activo: true })),
    ventas: async () => repo.memoria.ventas.filter((v) => v.producto_id === 1),
    modeloActivo: async () => (version === null ? null : { version, parametros: { alpha: 0.3, beta: 0.05, phi: 0.98 } }),
  });
  const base = await predecirProductos([1], { horizonte: 14, ahora: AHORA, repositorio: repoPrediccion(null) });
  const conTexto = await predecirProductos([1], { horizonte: 14, ahora: AHORA, repositorio: repoPrediccion('v7') });
  const conNumero = await predecirProductos([1], { horizonte: 14, ahora: AHORA, repositorio: repoPrediccion(7) }); // como viene de ml.modelos

  assert.equal(base.resultados[0].modelo.version, demanda.VERSION_MODELO);
  assert.equal(conTexto.resultados[0].modelo.version, 'v7');
  assert.equal(conNumero.resultados[0].modelo.version, 'v7');
  assert.deepEqual(conNumero.resultados[0].modelo.parametros, { alpha: 0.3, beta: 0.05, phi: 0.98 });
  assert.notEqual(conNumero.resultados[0].demanda_estimada, base.resultados[0].demanda_estimada);
  assert.ok(modelo.parametros);
});

// ---------------------------------------------------------------- TC-02: desempeño insuficiente

test('TC-02: si las métricas no cumplen el umbral, avisa y no pone el modelo en uso', async () => {
  const repo = crearRepositorio({ ventas: ventasSimuladas() });
  await servicio.entrenarModelo({ ahora: AHORA, repositorio: repo }); // v1 queda activo

  const r = await servicio.entrenarModelo({ ahora: new Date(AHORA.getTime() + dias(1)), repositorio: repo, config: umbralMinimo });

  assert.equal(r.activado, false);
  assert.equal(r.modelo.version, 'v2');
  assert.equal(r.modelo.estado, 'requiere_revision');
  assert.equal(r.aviso.codigo, 'requiere_revision');
  assert.match(r.aviso.mensaje, /Requiere revisión antes de ponerse en uso/);
  assert.match(r.mensaje, /requiere revisión/);
  assert.deepEqual([repo.memoria.entrenamientos[1].resultado, repo.memoria.entrenamientos[1].promovido], ['exitoso', false]);

  assert.equal((await repo.obtenerModeloActivo()).version, 1); // el modelo bueno anterior sigue en uso
  const estado = await servicio.listar({ repositorio: repo });
  assert.equal(estado.versiones[0].estado, 'requiere_revision');
  assert.ok(estado.avisos.some((a) => a.codigo === 'requiere_revision'));
});

test('una versión que requería revisión se puede activar después de revisarla', async () => {
  const repo = crearRepositorio({ ventas: ventasSimuladas() });
  await servicio.entrenarModelo({ ahora: AHORA, repositorio: repo });
  await servicio.entrenarModelo({ ahora: AHORA, repositorio: repo, config: umbralMinimo });

  const r = await servicio.activarVersion(2, { ahora: AHORA, repositorio: repo });
  assert.equal(r.modelo.estado, 'activo');
  const estado = await servicio.listar({ repositorio: repo });
  assert.deepEqual(estado.versiones.map((v) => [v.version, v.estado]), [['v2', 'activo'], ['v1', 'archivado']]);
  assert.ok(!estado.avisos.some((a) => a.codigo === 'requiere_revision'));

  await assert.rejects(() => servicio.activarVersion(99, { repositorio: repo }), (error) => error.estadoHttp === 404);
});

// ---------------------------------------------------------------- TC-07: alertar si el desempeño cae

test('TC-07: con ventas normales el modelo activo sigue cumpliendo el umbral y no hay alerta', async () => {
  const repo = crearRepositorio({ ventas: ventasSimuladas() });
  await servicio.entrenarModelo({ ahora: AHORA, repositorio: repo });
  const r = await servicio.evaluarModeloActivo({ ahora: AHORA, repositorio: repo });

  assert.equal(r.evaluacion.aprobado, true);
  assert.equal(r.aviso, null);
  assert.ok(r.evaluacion.rmse_relativo <= CONFIG_ML.UMBRAL_RMSE_RELATIVO);
  assert.equal(r.evaluacion.dias_evaluados, CONFIG_ML.DIAS_EVALUACION_RECIENTE);
  assert.ok((await repo.obtenerModeloActivo()).metadata.ultima_evaluacion); // queda guardada
});

test('TC-07: si la demanda cambia de golpe y el error supera el umbral, alerta y lo deja registrado', async () => {
  const repo = crearRepositorio({ ventas: ventasSimuladas() });
  await servicio.entrenarModelo({ ahora: AHORA, repositorio: repo });
  repo.memoria.ventas = ventasSimuladas({ cambio: { ultimosDias: 21, factor: 0.1 } }); // las ventas se desploman a 1/10

  const r = await servicio.evaluarModeloActivo({ ahora: AHORA, repositorio: repo });
  assert.equal(r.evaluacion.aprobado, false);
  assert.ok(r.evaluacion.rmse_relativo > CONFIG_ML.UMBRAL_RMSE_RELATIVO);
  assert.equal(r.aviso.codigo, 'desempeno_bajo');
  assert.equal(r.aviso.severidad, 'critica');
  assert.match(r.aviso.mensaje, /cayó por debajo del umbral aceptable/);

  const estado = await servicio.listar({ repositorio: repo }); // y el aviso sigue visible en la pantalla
  assert.ok(estado.avisos.some((a) => a.codigo === 'desempeno_bajo'));
});

test('TC-07: sin historial reciente suficiente informa que no se puede evaluar', async () => {
  const repo = crearRepositorio({ ventas: ventasSimuladas({ dias: 8 }) });
  await assert.rejects(() => servicio.evaluarModeloActivo({ ahora: AHORA, repositorio: repo }), (e) => e.codigo === 'datos_insuficientes' && e.estadoHttp === 422);
});

// ---------------------------------------------------------------- robustez

test('con pocas filas de ventas no entrena, lo registra como insuficiente_datos y no crea versiones', async () => {
  const repo = crearRepositorio({ ventas: ventasSimuladas({ productos: 1, dias: 9 }) }); // menos de 50 filas
  await assert.rejects(() => servicio.entrenarModelo({ ahora: AHORA, repositorio: repo }), (e) => e.codigo === 'datos_insuficientes' && e.estadoHttp === 422);
  assert.equal(repo.memoria.modelos.length, 0);
  assert.equal(repo.memoria.entrenamientos[0].resultado, 'insuficiente_datos');
  assert.equal(repo.memoria.entrenamientos[0].promovido, false);
  assert.equal(repo.memoria.preparaciones[0].listo_para_entrenar, false);
});

test('respeta el mínimo de filas configurado en ml.configuracion (min_filas_entrenamiento)', async () => {
  const repo = crearRepositorio({ ventas: ventasSimuladas(), minimoFilas: 100000 });
  await assert.rejects(
    () => servicio.entrenarModelo({ ahora: AHORA, repositorio: repo }),
    (e) => e.codigo === 'datos_insuficientes' && /100000/.test(e.message) && /min_filas_entrenamiento/.test(e.message),
  );
});

test('no permite dos entrenamientos a la vez y libera el cerrojo al terminar o al fallar', async () => {
  const repo = crearRepositorio({ ventas: ventasSimuladas() });
  let liberar;
  const espera = new Promise((resolver) => { liberar = resolver; });
  const ventasOriginal = repo.ventas;
  repo.ventas = async (...args) => { await espera; return ventasOriginal(...args); };

  const primero = servicio.entrenarModelo({ ahora: AHORA, repositorio: repo });
  await new Promise((resolver) => setImmediate(resolver));
  await assert.rejects(() => servicio.entrenarModelo({ ahora: AHORA, repositorio: repo }), (e) => e.codigo === 'entrenamiento_en_curso' && e.estadoHttp === 409);
  liberar();
  assert.equal((await primero).modelo.version, 'v1');

  repo.ventas = async () => { throw new Error('se cayó la conexión'); };
  await assert.rejects(() => servicio.entrenarModelo({ ahora: AHORA, repositorio: repo }), /se cayó la conexión/);

  repo.ventas = ventasOriginal; // el cerrojo se liberó: se puede volver a entrenar
  assert.equal((await servicio.entrenarModelo({ ahora: AHORA, repositorio: repo })).modelo.version, 'v2');
});

test('si fallan los registros auxiliares (logs), el modelo entrenado igual queda guardado', async () => {
  const repo = crearRepositorio({ ventas: ventasSimuladas() });
  repo.registrarEntrenamiento = async () => { throw new Error('sin permiso en ml.entrenamientos_log'); };
  repo.registrarPreparacion = async () => { throw new Error('sin permiso en ml.preparaciones_log'); };
  const r = await servicio.entrenarModelo({ ahora: AHORA, repositorio: repo });
  assert.equal(r.modelo.version, 'v1');
  assert.equal(repo.memoria.modelos.length, 1);
});

test('sin modelos entrenados la pantalla recibe un aviso informativo', async () => {
  const estado = await servicio.listar({ repositorio: crearRepositorio() });
  assert.equal(estado.modelo_activo, null);
  assert.deepEqual(estado.avisos.map((a) => a.codigo), ['sin_modelo_activo']);
  assert.equal(estado.umbral_rmse_relativo, 0.3);
  assert.equal(estado.ultimo_entrenamiento, null);
});

test('si faltan las tablas, la estructura no coincide o no hay permisos, responde con un mensaje claro y no con un 500', async () => {
  const falla = (codigo, mensaje) => ({
    listarModelos: async () => { throw Object.assign(new Error(mensaje), { parent: { code: codigo, message: mensaje } }); },
    listarEntrenamientos: async () => [],
  });
  await assert.rejects(() => servicio.listar({ repositorio: falla('42P01', 'relation "ml.modelos" does not exist') }),
    (e) => e.codigo === 'tablas_ml_no_disponibles' && e.estadoHttp === 503);
  await assert.rejects(() => servicio.listar({ repositorio: falla('42703', 'column "nombre" does not exist') }),
    (e) => e.codigo === 'estructura_ml_distinta' && e.estadoHttp === 503 && /nombre/.test(e.message));
  await assert.rejects(() => servicio.listar({ repositorio: falla('42501', 'permission denied') }),
    (e) => e.codigo === 'permisos_ml' && e.estadoHttp === 503);

  const otroError = new Error('otro problema');
  await assert.rejects(() => servicio.listar({ repositorio: { listarModelos: async () => { throw otroError; }, listarEntrenamientos: async () => [] } }),
    (e) => e === otroError); // los demás errores no se disfrazan

  // y el cerrojo se libera aunque falle al entrenar
  const roto = crearRepositorio({ ventas: ventasSimuladas() });
  roto.ventas = async () => { throw Object.assign(new Error('x'), { parent: { code: '42P01' } }); };
  await assert.rejects(() => servicio.entrenarModelo({ ahora: AHORA, repositorio: roto }), (e) => e.codigo === 'tablas_ml_no_disponibles');
  assert.equal((await servicio.entrenarModelo({ ahora: AHORA, repositorio: crearRepositorio({ ventas: ventasSimuladas() }) })).modelo.version, 'v1');
});

test('controlador: valida el id de la versión', () => {
  assert.equal(leerId({ id: '5' }), 5);
  assert.equal(leerId({ id: 'abc' }), null);
  assert.equal(leerId({ id: '0' }), null);
  assert.equal(leerId({ id: '1.5' }), null);
});
