// HU-118 (US-23) · QA-01 — Casos de prueba de "Configurar umbral de días para alerta de vencimiento" (TC-01 a TC-07).
// Usa un repositorio en memoria: no necesita base de datos.
const test = require('node:test');
const assert = require('node:assert/strict');

const reglas = require('../../src/services/reglasUmbralVencimiento');
const servicio = require('../../src/services/umbralVencimientoService');

const HOY = new Date('2026-11-06T12:00:00-05:00');

// ---- repositorio falso -------------------------------------------------------------------------
function repoFalso({ categorias = [{ id: 1, nombre: 'Lácteos' }, { id: 2, nombre: 'Abarrotes' }], lotes = [], claves = {} } = {}) {
  const config = new Map(Object.entries(claves).map(([clave, valor]) => [clave, { clave, valor: String(valor), fecha_actualizacion: new Date() }]));
  const alertas = [];
  let siguienteAlerta = 1;
  return {
    config, alertas,
    configuraciones: async () => [...config.values()],
    categorias: async () => categorias,
    categoriaPorId: async (id) => categorias.find((c) => c.id === Number(id)) ?? null,
    guardarClave: async (clave, valor) => { config.set(clave, { clave, valor: String(valor), fecha_actualizacion: new Date() }); },
    borrarClave: async (clave) => (config.delete(clave) ? 1 : 0),
    lotesConStock: async () => lotes,
    alertasAbiertas: async () => alertas.filter((a) => ['nueva', 'vista'].includes(a.estado)),
    crearAlerta: async (datos) => { alertas.push({ id: siguienteAlerta++, ...datos }); },
    actualizarAlerta: async (id, datos) => { Object.assign(alertas.find((a) => a.id === id), datos); },
  };
}

const lote = (id, categoria_id, fecha_vencimiento, extra = {}) => ({
  id, numero_lote: `LT-${id}`, producto_id: id * 10, producto_codigo: `P${id}`, producto_nombre: `Producto ${id}`,
  producto_activo: true, categoria_id, cantidad_actual: 5, fecha_vencimiento, ...extra,
});

// ---- TC-01 -------------------------------------------------------------------------------------
test('TC-01: el nuevo umbral guardado se aplica en el siguiente cálculo de riesgo', async () => {
  // Lote que vence en 20 días: con el umbral por defecto (30) está en riesgo; con 10 ya no.
  const repo = repoFalso({ lotes: [lote(1, 1, '2026-11-26')] });
  assert.equal((await servicio.evaluarRiesgoVencimiento({ repo, hoy: HOY })).total_en_riesgo, 1);

  await servicio.guardarUmbral({ dias: 10 }, repo);
  const despues = await servicio.evaluarRiesgoVencimiento({ repo, hoy: HOY });
  assert.equal(despues.total_en_riesgo, 0);

  await servicio.guardarUmbral({ dias: 25 }, repo);
  const subido = await servicio.evaluarRiesgoVencimiento({ repo, hoy: HOY });
  assert.equal(subido.total_en_riesgo, 1);
  assert.equal(subido.data[0].umbral_dias, 25);
  assert.equal(subido.data[0].dias_restantes, 20);
});

// ---- TC-02 y TC-05 -----------------------------------------------------------------------------
test('TC-02 y TC-05: rechaza negativos, cero, decimales, texto y vacíos', () => {
  for (const malo of [-5, '-5', 0, '0', 2.5, '2.5', 'abc', '', '   ', null, undefined, NaN, Infinity, true, {}, [], '1e2', 3651]) {
    assert.throws(() => reglas.validarDiasVencimiento(malo), reglas.ErrorUmbralVencimiento, `debía rechazar ${String(malo)}`);
  }
});

test('TC-02: un valor inválido no modifica la configuración guardada', async () => {
  const repo = repoFalso({ claves: { [servicio.CLAVE_GLOBAL]: 15 } });
  await assert.rejects(servicio.guardarUmbral({ dias: -3 }, repo), /mayor a cero/);
  await assert.rejects(servicio.guardarUmbral({ categoriaId: 1, dias: 'abc' }, repo), /numérico/);
  assert.equal(repo.config.get(servicio.CLAVE_GLOBAL).valor, '15');
  assert.equal(repo.config.size, 1);
});

test('TC-05: acepta enteros positivos como número o texto', () => {
  assert.equal(reglas.validarDiasVencimiento(30), 30);
  assert.equal(reglas.validarDiasVencimiento('45'), 45);
  assert.equal(reglas.validarDiasVencimiento(' 7 '), 7);
  assert.equal(reglas.validarDiasVencimiento('10.0'), 10);
  assert.equal(reglas.validarDiasVencimiento(3650), 3650);
});

// ---- TC-03 -------------------------------------------------------------------------------------
test('TC-03: permite definir el umbral en días y lo informa en la configuración', async () => {
  const repo = repoFalso();
  const sinConfigurar = await servicio.obtenerConfiguracion(repo);
  assert.deepEqual([sinConfigurar.general.dias, sinConfigurar.general.configurado], [30, false]);

  const guardado = await servicio.guardarUmbral({ dias: 14 }, repo);
  assert.equal(guardado.dias, 14);
  assert.equal(guardado.dias_anterior, 30);
  assert.equal(guardado.alcance, 'general');

  const config = await servicio.obtenerConfiguracion(repo);
  assert.deepEqual([config.general.dias, config.general.configurado], [14, true]);
  assert.ok(config.categorias.every((c) => c.dias === 14 && c.origen === 'global' && c.configurado === false));
});

// ---- TC-04 -------------------------------------------------------------------------------------
test('TC-04: aplica el umbral al riesgo y ordena del más urgente al menos urgente', async () => {
  const repo = repoFalso({
    claves: { [servicio.CLAVE_GLOBAL]: 15 },
    lotes: [
      lote(1, 1, '2026-11-20'), // 14 días  -> en riesgo
      lote(2, 1, '2026-11-21'), // 15 días  -> en riesgo (límite incluido)
      lote(3, 1, '2026-11-22'), // 16 días  -> vigente
      lote(4, 1, '2026-11-04'), // -2 días  -> vencido
      lote(5, 1, '2026-11-06'), // hoy      -> en riesgo (0 días)
      lote(6, 1, null),         // sin fecha -> no aplica
      lote(7, 1, '2026-11-10', { producto_activo: false }), // producto inactivo: no se evalúa
    ],
  });
  const r = await servicio.evaluarRiesgoVencimiento({ repo, hoy: HOY });
  assert.deepEqual(r.data.map((f) => [f.lote_id, f.estado]), [
    [4, 'vencido'], [5, 'en_riesgo'], [1, 'en_riesgo'], [2, 'en_riesgo'],
  ]);
  assert.equal(r.data[0].severidad, 'critica');
  assert.equal(r.lotes_evaluados, 6);
});

test('TC-04: las reglas clasifican el lote con el umbral dado (límites)', () => {
  assert.equal(reglas.evaluarLote(31, 30).estado, 'vigente');
  assert.equal(reglas.evaluarLote(30, 30).estado, 'en_riesgo');
  assert.equal(reglas.evaluarLote(0, 30).estado, 'en_riesgo');
  assert.equal(reglas.evaluarLote(-1, 30).estado, 'vencido');
  assert.equal(reglas.evaluarLote(null, 30).estado, 'vigente');
  assert.equal(reglas.evaluarLote(5, 30).severidad, 'alta');
  assert.equal(reglas.evaluarLote(15, 30).severidad, 'media');
  assert.equal(reglas.evaluarLote(25, 30).severidad, 'baja');
});

test('TC-04: al guardar se actualizan las alertas (crea, actualiza y resuelve)', async () => {
  const repo = repoFalso({ lotes: [lote(1, 1, '2026-11-16'), lote(2, 2, '2026-12-01')] });
  const primera = await servicio.generarAlertasVencimiento({ repo, hoy: HOY });
  assert.deepEqual([primera.creadas, primera.actualizadas, primera.resueltas], [2, 0, 0]);
  assert.equal(repo.alertas[0].tipo, 'riesgo_vencimiento');
  assert.equal(repo.alertas[0].lote_id, 1);

  await servicio.guardarUmbral({ dias: 12 }, repo); // el lote 1 (10 días) sigue, el 2 (25 días) sale
  const segunda = await servicio.generarAlertasVencimiento({ repo, hoy: HOY });
  assert.deepEqual([segunda.creadas, segunda.actualizadas, segunda.resueltas], [0, 1, 1]);
  assert.equal(repo.alertas.find((a) => a.lote_id === 2).estado, 'atendida');
  assert.equal(repo.alertas.find((a) => a.lote_id === 1).datos_origen.umbral_dias, 12);
});

// ---- TC-06 -------------------------------------------------------------------------------------
test('TC-06: permite umbrales distintos por categoría y la categoría manda sobre el general', async () => {
  const repo = repoFalso({
    lotes: [lote(1, 1, '2026-11-16'), lote(2, 2, '2026-11-16')], // ambos vencen en 10 días
  });
  await servicio.guardarUmbral({ dias: 30 }, repo);
  const lacteos = await servicio.guardarUmbral({ categoriaId: 1, dias: 5 }, repo);
  assert.equal(lacteos.alcance, 'categoria');
  assert.equal(lacteos.categoria_nombre, 'Lácteos');
  assert.equal(lacteos.dias_anterior, 30);

  const r = await servicio.evaluarRiesgoVencimiento({ repo, hoy: HOY });
  assert.deepEqual(r.data.map((f) => f.lote_id), [2]); // lácteos (umbral 5) ya no está en riesgo
  assert.equal(r.data[0].umbral_dias, 30);
  assert.equal(r.data[0].origen_umbral, 'global');

  const config = await servicio.obtenerConfiguracion(repo);
  const fila = config.categorias.find((c) => c.categoria_id === 1);
  assert.deepEqual([fila.dias, fila.configurado, fila.origen], [5, true, 'categoria']);
});

test('TC-06: restablecer una categoría vuelve al umbral general', async () => {
  const repo = repoFalso();
  await servicio.guardarUmbral({ dias: 20 }, repo);
  await servicio.guardarUmbral({ categoriaId: 2, dias: 3 }, repo);
  const r = await servicio.restablecerUmbralCategoria(2, repo);
  assert.equal(r.dias, 20);
  await assert.rejects(servicio.restablecerUmbralCategoria(2, repo), /ya usaba/);
});

test('TC-06: rechaza una categoría que no existe o un id inválido', async () => {
  const repo = repoFalso();
  await assert.rejects(servicio.guardarUmbral({ categoriaId: 99, dias: 5 }, repo), (e) => e.status === 404);
  await assert.rejects(servicio.guardarUmbral({ categoriaId: 'x', dias: 5 }, repo), (e) => e.status === 400);
  await assert.rejects(servicio.guardarUmbral({ categoriaId: -1, dias: 5 }, repo), (e) => e.status === 400);
});

// ---- TC-07 -------------------------------------------------------------------------------------
test('TC-07: confirma el cambio con un mensaje claro', async () => {
  const repo = repoFalso();
  const general = await servicio.guardarUmbral({ dias: 21 }, repo);
  assert.match(servicio.mensajeConfirmacion(general), /Umbral general guardado: se alertará 21 días antes/);
  const categoria = await servicio.guardarUmbral({ categoriaId: 1, dias: 1 }, repo);
  assert.match(servicio.mensajeConfirmacion(categoria), /«Lácteos» guardado: se alertará 1 día antes/);
});

// ---- robustez ----------------------------------------------------------------------------------
test('un valor dañado en la base se ignora y se usa el siguiente nivel', async () => {
  const repo = repoFalso({
    claves: { [servicio.CLAVE_GLOBAL]: 'basura', [`${servicio.PREFIJO_CATEGORIA}1`]: '-4' },
    lotes: [lote(1, 1, '2026-11-26')],
  });
  const r = await servicio.evaluarRiesgoVencimiento({ repo, hoy: HOY });
  assert.equal(r.data[0].umbral_dias, 30);
  assert.equal(r.data[0].origen_umbral, 'predeterminado');
});

test('el resolvedor devuelve categoría > general > predeterminado', async () => {
  const repo = repoFalso({ claves: { [servicio.CLAVE_GLOBAL]: 12, [`${servicio.PREFIJO_CATEGORIA}2`]: 4 } });
  const resolver = await servicio.obtenerResolvedor(repo);
  assert.deepEqual(resolver(2), { dias: 4, origen: 'categoria' });
  assert.deepEqual(resolver(1), { dias: 12, origen: 'global' });
  assert.deepEqual(resolver(null), { dias: 12, origen: 'global' });
  assert.deepEqual(reglas.resolverUmbral(1, {}), { dias: 30, origen: 'predeterminado' });
});
