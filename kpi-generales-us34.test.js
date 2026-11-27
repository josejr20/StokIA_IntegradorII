'use strict';

/**
 * US-34 · HU-177 QA-01 (backend): TC-01 a TC-07 de los KPIs generales.
 * Usa un repositorio en memoria; no toca Supabase.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const calculo = require('../src/services/kpiGeneralesCalculo');
const { obtenerKpisGenerales } = require('../src/services/kpiGeneralesService');

const AHORA = new Date('2026-11-26T15:00:00Z'); // 26/11/2026 10:00 en Perú

/** Repositorio falso con datos suficientes por defecto. */
function repo(cambios = {}) {
  return {
    primerDato: async () => '2026-01-01',
    diasConVentas: async () => 40,
    ventasNetas: async () => ({ costo: 30000, unidades: 3000 }),
    inventarioAl: async () => ({ valor: 10000, unidades: 1000 }),
    alertasAtendidas: async () => [],
    lotes: async () => [],
    salidasPorVenta: async () => [],
    ...cambios,
  };
}

// ---------- TC-06: selección de periodo ----------

test('TC-06: resuelve periodos predefinidos y personalizados', () => {
  assert.deepEqual(calculo.resolverPeriodo({ periodo: '30d' }, AHORA),
    { tipo: '30d', desde: '2026-10-28', hasta: '2026-11-26', dias: 30 });
  assert.deepEqual(calculo.resolverPeriodo({ periodo: 'mes_actual' }, AHORA),
    { tipo: 'mes_actual', desde: '2026-11-01', hasta: '2026-11-26', dias: 26 });
  assert.deepEqual(calculo.resolverPeriodo({ periodo: 'mes_anterior' }, AHORA),
    { tipo: 'mes_anterior', desde: '2026-10-01', hasta: '2026-10-31', dias: 31 });
  assert.deepEqual(calculo.resolverPeriodo({ desde: '2026-01-01', hasta: '2026-03-31' }, AHORA),
    { tipo: 'personalizado', desde: '2026-01-01', hasta: '2026-03-31', dias: 90 });
  assert.equal(calculo.resolverPeriodo({}, AHORA).tipo, '90d', 'por defecto 90 días');
});

test('TC-06: rechaza periodos inválidos', () => {
  const invalidos = [
    { periodo: 'cualquiera' },
    { desde: '2026-01-01' },
    { desde: '2026-02-31', hasta: '2026-03-01' },
    { desde: '2026-05-01', hasta: '2026-04-01' },
    { desde: '2026-11-01', hasta: '2026-12-31' }, // futuro
    { desde: '2025-01-01', hasta: '2026-11-26' }, // más de 366 días
  ];
  for (const filtros of invalidos) {
    assert.throws(() => calculo.resolverPeriodo(filtros, AHORA), (e) => e.name === 'ErrorPeriodo' && e.statusCode === 400, JSON.stringify(filtros));
  }
});

test('el "hoy" se toma en hora de Perú aunque el servidor esté en UTC', () => {
  assert.equal(calculo.hoyEnPeru(new Date('2026-11-27T03:00:00Z')), '2026-11-26');
});

test('puntos de muestreo: inicio, cada mes intermedio y cierre', () => {
  assert.deepEqual(calculo.puntosDeMuestreo({ desde: '2026-01-15', hasta: '2026-04-10' }),
    ['2026-01-15', '2026-02-01', '2026-03-01', '2026-04-01', '2026-04-11']);
  assert.deepEqual(calculo.puntosDeMuestreo({ desde: '2026-11-01', hasta: '2026-11-26' }), ['2026-11-01', '2026-11-27']);
});

// ---------- TC-03 / HU-174: rotación ----------

test('TC-03: rotación = costo de ventas / inventario promedio', () => {
  const r = calculo.calcularRotacion({
    costoVentas: 30000, unidadesVendidas: 3000, dias: 90,
    snapshots: [{ valor: 8000, unidades: 800 }, { valor: 12000, unidades: 1200 }],
  });
  assert.equal(r.calculable, true);
  assert.equal(r.base, 'valorizado');
  assert.equal(r.inventario_promedio_valor, 10000);
  assert.equal(r.valor, 3);            // 30000 / 10000
  assert.equal(r.dias_inventario, 30); // 90 / 3
});

test('TC-03: sin costos en el kardex usa unidades como respaldo', () => {
  const r = calculo.calcularRotacion({
    costoVentas: 0, unidadesVendidas: 500, dias: 30,
    snapshots: [{ valor: 0, unidades: 250 }, { valor: 0, unidades: 250 }],
  });
  assert.equal(r.base, 'unidades');
  assert.equal(r.valor, 2);
});

test('TC-03: sin inventario o sin ventas no es calculable', () => {
  assert.equal(calculo.calcularRotacion({ costoVentas: 100, unidadesVendidas: 10, dias: 30, snapshots: [{ valor: 0, unidades: 0 }] }).calculable, false);
  assert.equal(calculo.calcularRotacion({ costoVentas: 0, unidadesVendidas: 0, dias: 30, snapshots: [{ valor: 100, unidades: 10 }] }).calculable, false);
});

// ---------- TC-04 / HU-175: mermas evitadas ----------

const alertaDe = (loteId, enRiesgo, creada = '2026-10-01T10:00:00-05:00') => ({
  lote_id: loteId, fecha_creacion: creada, datos_origen: { unidades_en_riesgo: enRiesgo },
});

test('TC-04: cuenta lo vendido tras la alerta, sin superar las unidades en riesgo', () => {
  const m = calculo.calcularMermasEvitadas({
    alertas: [alertaDe(1, 30)],
    lotes: new Map([[1, { fecha_vencimiento: '2026-11-30' }]]),
    salidas: [
      { lote_id: 1, fecha: '2026-09-20T10:00:00-05:00', cantidad: 50, precio_unitario: 2 }, // antes de la alerta: no cuenta
      { lote_id: 1, fecha: '2026-10-05T10:00:00-05:00', cantidad: 20, precio_unitario: 2 },
      { lote_id: 1, fecha: '2026-10-10T10:00:00-05:00', cantidad: 40, precio_unitario: 3 }, // solo caben 10
      { lote_id: 1, fecha: '2026-12-05T10:00:00-05:00', cantidad: 10, precio_unitario: 3 }, // tras el vencimiento
    ],
  });
  assert.equal(m.unidades, 30);
  assert.equal(m.valor, 70); // 20*2 + 10*3
  assert.equal(m.lotes, 1);
});

test('TC-04: varias alertas del mismo lote no duplican el conteo', () => {
  const m = calculo.calcularMermasEvitadas({
    alertas: [alertaDe(1, 10, '2026-10-01T10:00:00-05:00'), alertaDe(1, 25, '2026-10-03T10:00:00-05:00')],
    lotes: new Map([[1, { fecha_vencimiento: null }]]),
    salidas: [{ lote_id: 1, fecha: '2026-10-04T10:00:00-05:00', cantidad: 100, precio_unitario: 1 }],
  });
  assert.equal(m.unidades, 25);
  assert.equal(m.alertas, 2);
  assert.equal(m.lotes, 1);
});

test('TC-04: alertas sin unidades en riesgo o sin ventas posteriores dan cero', () => {
  const m = calculo.calcularMermasEvitadas({
    alertas: [alertaDe(1, 0), alertaDe(2, 10)],
    lotes: new Map(), salidas: [],
  });
  assert.deepEqual(m, { unidades: 0, valor: 0, lotes: 0, alertas: 1 });
});

// ---------- TC-01 / TC-05: consulta exitosa ----------

test('TC-01/TC-05: con datos suficientes devuelve los indicadores del periodo', async () => {
  const r = await obtenerKpisGenerales({ periodo: '90d' }, {
    ahora: AHORA,
    repositorio: repo({
      alertasAtendidas: async () => [{ ...alertaDe(1, 30), fecha_atendida: '2026-10-20T10:00:00-05:00' }],
      lotes: async () => [{ id: 1, fecha_vencimiento: '2026-12-31' }],
      salidasPorVenta: async () => [{ lote_id: 1, fecha: '2026-10-05T10:00:00-05:00', cantidad: 20, precio_unitario: 2.5 }],
    }),
  });

  assert.equal(r.suficiente, true);
  assert.equal(r.mensaje, null);
  assert.equal(r.periodo.dias, 90);
  assert.equal(r.rotacion.calculable, true);
  assert.equal(r.rotacion.valor, 3);
  assert.equal(r.mermas_evitadas.calculable, true);
  assert.equal(r.mermas_evitadas.unidades, 20);
  assert.equal(r.mermas_evitadas.valor, 50);
  assert.ok(r.metodologia.rotacion && r.metodologia.mermas_evitadas);
});

test('TC-01: el periodo elegido cambia el cálculo (se consulta con sus fechas)', async () => {
  const consultas = [];
  await obtenerKpisGenerales({ periodo: 'mes_anterior' }, {
    ahora: AHORA,
    repositorio: repo({ ventasNetas: async (p) => { consultas.push(p); return { costo: 100, unidades: 10 }; } }),
  });
  assert.deepEqual(consultas[0], { desde: '2026-10-01', finExclusivo: '2026-11-01' });
});

// ---------- TC-02 / TC-07: datos insuficientes ----------

test('TC-02/TC-07: sin historial indica que no es posible calcular', async () => {
  const r = await obtenerKpisGenerales({ periodo: '90d' }, {
    ahora: AHORA,
    repositorio: repo({
      primerDato: async () => null,
      diasConVentas: async () => 0,
      ventasNetas: async () => ({ costo: 0, unidades: 0 }),
      inventarioAl: async () => ({ valor: 0, unidades: 0 }),
    }),
  });
  assert.equal(r.suficiente, false);
  assert.match(r.mensaje, /no es posible calcular/i);
  assert.equal(r.rotacion.calculable, false);
  assert.equal(r.rotacion.valor, null);
  assert.equal(r.mermas_evitadas.calculable, false);
  assert.ok(r.razones.length >= 1);
});

test('TC-07: el historial recién empezado (cubre <50% del periodo) no alcanza', async () => {
  const r = await obtenerKpisGenerales({ periodo: '90d' }, {
    ahora: AHORA, repositorio: repo({ primerDato: async () => '2026-11-10' }),
  });
  assert.equal(r.suficiente, false);
  assert.match(r.razones.join(' '), /historial cubre solo/i);
});

test('TC-07: pocas jornadas con ventas no alcanzan', async () => {
  const r = await obtenerKpisGenerales({ periodo: '30d' }, {
    ahora: AHORA, repositorio: repo({ diasConVentas: async () => 2 }),
  });
  assert.equal(r.suficiente, false);
  assert.match(r.razones.join(' '), /2 día\(s\) con ventas/);
  assert.equal(r.rotacion.calculable, false);
});

test('un periodo inválido propaga ErrorPeriodo (400)', async () => {
  await assert.rejects(() => obtenerKpisGenerales({ periodo: 'x' }, { ahora: AHORA, repositorio: repo() }),
    (e) => e.statusCode === 400);
});
