// HU-128 (US-25) · QA-01 — Casos de prueba de "Consultar histórico de predicciones vs ventas reales" (TC-01 a TC-07).
// Usa ventas simuladas y un repositorio en memoria: no necesita base de datos.
const test = require('node:test');
const assert = require('node:assert/strict');

const modelo = require('../../src/services/prediccionDemandaModelo');
const historico = require('../../src/services/historicoPrediccionModelo');
const { compararPrediccionVsVentas } = require('../../src/services/historicoPrediccionService');
const { historial } = require('../../src/controllers/prediccionController');

const AHORA = new Date('2026-10-21T15:00:00-05:00'); // el último día completo es el 20/oct
const ULTIMO = '2026-10-20';

// Ventas diarias simuladas del día `desde` al `hasta`. `patron[d]` = unidades por día de la semana (0 = domingo).
function ventasSimuladas(productoId, { desde = '2026-07-01', hasta = ULTIMO, patron = [2, 10, 10, 10, 10, 14, 20], multiplicador = 1, saltar = () => false } = {}) {
  const ventas = [];
  for (let dia = desde; dia <= hasta; dia = modelo.sumarDias(dia, 1)) {
    const cantidad = patron[modelo.diaSemana(dia)] * multiplicador;
    if (cantidad > 0 && !saltar(dia)) ventas.push({ producto_id: productoId, fecha_venta: `${dia}T15:00:00-05:00`, cantidad: String(cantidad) });
  }
  return ventas;
}

function repoFalso({ productos, ventas }) {
  return {
    producto: async (id) => productos.find((p) => p.id === id) ?? null,
    productos: async (ids) => productos.filter((p) => ids.includes(p.id)),
    ventas: async (productoId, desde, hastaExclusivo) => ventas.filter((v) => {
      const ms = new Date(v.fecha_venta).getTime();
      return (productoId === null || v.producto_id === productoId) && ms >= desde.getTime() && ms < hastaExclusivo.getTime();
    }),
    modeloActivo: async () => null,
  };
}

const PRODUCTOS = [
  { id: 1, codigo: 'P1', nombre: 'Leche', activo: true },
  { id: 2, codigo: 'P2', nombre: 'Arroz', activo: true },
];

const consultar = (query, datos) => compararPrediccionVsVentas(
  historico.validarFiltros(query, AHORA),
  { repositorio: repoFalso(datos), ahora: AHORA },
);

// ---- TC-01 / TC-03 / TC-05 -----------------------------------------------------------------------
test('TC-01 y TC-03: muestra predicción y venta real por producto y periodo', async () => {
  const r = await consultar({ producto_id: 1, desde: '2026-09-01', hasta: ULTIMO }, { productos: PRODUCTOS, ventas: ventasSimuladas(1) });
  assert.equal(r.hay_datos, true);
  assert.equal(r.mensaje, null);
  assert.equal(r.periodos.length, 7); // 50 días -> 7 periodos completos de 7 días
  assert.equal(r.detalle.length, 7);
  for (const fila of r.detalle) {
    assert.equal(fila.producto_id, 1);
    assert.equal(fila.estado, 'ok');
    assert.ok(fila.prediccion > 0 && fila.venta_real > 0);
    assert.equal(fila.venta_real, 76); // 2+10+10+10+10+14+20 por semana
  }
  // Los datos de cada periodo vienen listos para graficar (TC-05): un punto con ambos valores.
  for (const p of r.periodos) assert.ok(typeof p.prediccion === 'number' && typeof p.venta_real === 'number');
});

test('TC-01: la predicción de un periodo solo usa lo vendido ANTES del periodo', () => {
  // Hasta el 7/sep hay ventas normales; en la semana 8-14/sep se vende 10 veces más.
  const base = ventasSimuladas(1, { hasta: '2026-09-07' });
  const pico = ventasSimuladas(1, { desde: '2026-09-08', hasta: '2026-09-14', multiplicador: 10 });
  const periodo = { inicio: '2026-09-08', fin: '2026-09-14' };
  const sinPico = historico.compararPeriodo(base, periodo, { periodoDias: 7 });
  const conPico = historico.compararPeriodo([...base, ...pico], periodo, { periodoDias: 7 });
  assert.equal(sinPico.prediccion, conPico.prediccion); // el pico (futuro) no contamina la predicción
  assert.equal(conPico.venta_real, 760);
  assert.ok(conPico.diferencia_pct < -80); // el modelo subestimó mucho
});

// ---- TC-04 ---------------------------------------------------------------------------------------
test('TC-04: calcula la diferencia porcentual (predicción - real) / real', () => {
  const ventas = ventasSimuladas(1, { hasta: '2026-09-14' });
  const fila = historico.compararPeriodo(ventas, { inicio: '2026-09-08', fin: '2026-09-14' }, { periodoDias: 7 });
  assert.equal(fila.estado, 'ok');
  assert.equal(fila.diferencia, Math.round((fila.prediccion - fila.venta_real) * 100) / 100);
  assert.equal(fila.diferencia_pct, Math.round((fila.diferencia / fila.venta_real) * 10000) / 100);
  // Con un patrón estable el modelo acierta: el error es pequeño.
  assert.ok(Math.abs(fila.diferencia_pct) < 15, `error inesperado: ${fila.diferencia_pct}%`);
});

test('TC-04: el resumen calcula error ponderado, precisión y sesgo', () => {
  const resumen = historico.resumir([
    { estado: 'ok', prediccion: 110, venta_real: 100, diferencia: 10 },
    { estado: 'ok', prediccion: 80, venta_real: 100, diferencia: -20 },
    { estado: 'sin_datos', prediccion: null, venta_real: null, diferencia: null },
  ]);
  assert.deepEqual(resumen, {
    comparaciones: 2, sin_datos: 1, error_porcentual_ponderado: 15, precision_pct: 85, sesgo_pct: -5,
  });
  assert.equal(historico.resumir([]).precision_pct, null);
});

test('TC-04: los totales por periodo suman solo filas comparables', async () => {
  const ventas = [...ventasSimuladas(1), ...ventasSimuladas(2, { multiplicador: 2 })];
  const r = await consultar({ desde: '2026-09-01', hasta: '2026-09-14' }, { productos: PRODUCTOS, ventas });
  assert.equal(r.periodos.length, 2);
  for (const p of r.periodos) {
    const filas = r.detalle.filter((f) => f.periodo_inicio === p.periodo_inicio);
    assert.equal(p.productos_comparados, 2);
    assert.equal(p.venta_real, Math.round(filas.reduce((s, f) => s + f.venta_real, 0) * 100) / 100);
    assert.equal(p.prediccion, Math.round(filas.reduce((s, f) => s + f.prediccion, 0) * 100) / 100);
  }
});

// ---- TC-02 y TC-07 -------------------------------------------------------------------------------
test('TC-02 y TC-07: un periodo sin ventas reales indica que no hay datos suficientes', async () => {
  // El producto vende normalmente salvo en la semana 15-21/sep.
  const ventas = ventasSimuladas(1, { saltar: (dia) => dia >= '2026-09-15' && dia <= '2026-09-21' });
  const r = await consultar({ producto_id: 1, desde: '2026-09-08', hasta: '2026-09-28' }, { productos: PRODUCTOS, ventas });
  const vacio = r.detalle.find((f) => f.periodo_inicio === '2026-09-15');
  assert.equal(vacio.estado, 'sin_datos');
  assert.equal(vacio.motivo, 'sin_ventas_reales');
  assert.equal(vacio.venta_real, null);
  assert.equal(vacio.diferencia_pct, null);
  assert.match(vacio.mensaje, /no hay datos suficientes/i);
  const total = r.periodos.find((p) => p.periodo_inicio === '2026-09-15');
  assert.equal(total.estado, 'sin_datos');
  assert.match(total.mensaje, /no hay datos suficientes/i);
  // Los otros periodos siguen comparándose con normalidad.
  assert.equal(r.periodos.filter((p) => p.estado === 'ok').length, 2);
  assert.equal(r.hay_datos, true);
});

test('TC-07: sin ventas en todo el rango la respuesta lo indica claramente', async () => {
  const r = await consultar({ producto_id: 2, desde: '2026-09-01', hasta: '2026-09-28' }, { productos: PRODUCTOS, ventas: ventasSimuladas(1) });
  assert.equal(r.hay_datos, false);
  assert.match(r.mensaje, /no hay datos suficientes para comparar/i);
  assert.ok(r.periodos.every((p) => p.estado === 'sin_datos'));
  assert.equal(r.resumen.comparaciones, 0);
  assert.equal(r.resumen.precision_pct, null);
});

test('TC-07: con ventas reales pero sin historial para predecir también avisa', () => {
  const pocas = ventasSimuladas(1, { desde: '2026-09-10', hasta: '2026-09-14' }); // solo 5 días de historia
  const fila = historico.compararPeriodo(pocas, { inicio: '2026-09-12', fin: '2026-09-18' }, { periodoDias: 7 });
  assert.equal(fila.estado, 'sin_datos');
  assert.equal(fila.motivo, 'historial_insuficiente');
  assert.equal(fila.prediccion, null);
  assert.match(fila.mensaje, /no hay datos suficientes/i);
});

// ---- TC-06 ---------------------------------------------------------------------------------------
test('TC-06: filtra por producto', async () => {
  const datos = { productos: PRODUCTOS, ventas: [...ventasSimuladas(1), ...ventasSimuladas(2)] };
  const todos = await consultar({ desde: '2026-09-01', hasta: '2026-09-14' }, datos);
  assert.deepEqual([...new Set(todos.detalle.map((f) => f.producto_id))].sort(), [1, 2]);
  const uno = await consultar({ producto_id: 2, desde: '2026-09-01', hasta: '2026-09-14' }, datos);
  assert.deepEqual([...new Set(uno.detalle.map((f) => f.producto_id))], [2]);
  assert.equal(uno.filtros.producto_id, 2);
});

test('TC-06: filtra por rango de fechas y tamaño de periodo', async () => {
  const datos = { productos: PRODUCTOS, ventas: ventasSimuladas(1) };
  const r = await consultar({ producto_id: 1, desde: '2026-09-01', hasta: '2026-09-21', periodo_dias: '7' }, datos);
  assert.deepEqual(r.periodos.map((p) => p.periodo_inicio), ['2026-09-01', '2026-09-08', '2026-09-15']);
  assert.equal(r.periodos[2].periodo_fin, '2026-09-21');
  const dias = await consultar({ producto_id: 1, desde: '2026-09-01', hasta: '2026-09-03', periodo_dias: '1' }, datos);
  assert.equal(dias.periodos.length, 3);
});

test('TC-06: valida los filtros', () => {
  const malo = (query, patron) => assert.throws(() => historico.validarFiltros(query, AHORA), patron);
  malo({ producto_id: 'abc' }, /producto/i);
  malo({ producto_id: '-1' }, /producto/i);
  malo({ desde: '2026-02-30' }, /fecha inicial/i);
  malo({ hasta: '10/09/2026' }, /fecha final/i);
  malo({ desde: '2026-09-10', hasta: '2026-09-01' }, /no puede ser posterior/i);
  malo({ periodo_dias: '5' }, /periodo/i);
  malo({ desde: '2025-01-01', hasta: ULTIMO }, /no puede superar 365/);
  assert.throws(() => historico.construirPeriodos('2026-09-01', '2026-09-03', 7), /menor que un periodo/);
  assert.throws(() => historico.construirPeriodos('2026-01-01', '2026-06-30', 1), /máximo es 26/);
});

test('TC-06: sin filtros usa las últimas 12 semanas hasta ayer y no incluye el día en curso', () => {
  const f = historico.validarFiltros({}, AHORA);
  assert.equal(f.hasta, ULTIMO);
  assert.equal(f.desde, '2026-07-29');
  assert.equal(f.periodoDias, 7);
  const futuro = historico.validarFiltros({ hasta: '2026-12-31' }, AHORA);
  assert.equal(futuro.hasta, ULTIMO);
  assert.equal(futuro.hastaAjustado, true);
});

test('un producto inexistente responde 404', async () => {
  await assert.rejects(
    consultar({ producto_id: 99, desde: '2026-09-01', hasta: '2026-09-14' }, { productos: PRODUCTOS, ventas: [] }),
    (e) => e instanceof historico.ErrorHistorico && e.status === 404,
  );
});

test('las devoluciones y anulaciones no cuentan: el repositorio solo entrega ventas netas', () => {
  const { ORIGENES_VENTA } = require('../../src/services/prediccionDemandaService');
  assert.deepEqual(ORIGENES_VENTA, ['manual', 'importado']);
});

// ---- controlador ---------------------------------------------------------------------------------
test('el controlador responde 400 con un mensaje claro si los filtros son inválidos', async () => {
  let estado; let cuerpo;
  const res = { status(c) { estado = c; return this; }, json(b) { cuerpo = b; return this; } };
  await historial({ query: { periodo_dias: '3' } }, res, (e) => { throw e; });
  assert.equal(estado, 400);
  assert.match(cuerpo.error, /periodo/i);
});
