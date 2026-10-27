const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluarProducto } = require('../src/services/recomendacionMotor');

const hoy = '2026-10-26';
const base = {
  id: 12, codigo: 'P-012', nombre: 'Producto de prueba',
  lotes: [], ventas_netas_30d: 0, registros_ventas_30d: 0,
};
const lote = (cantidad_actual, fecha_vencimiento) => ({ cantidad_actual, fecha_vencimiento });
const evaluar = (cambios) => evaluarProducto({ ...base, ...cambios }, { hoy });

test('TC-01: riesgo alto cercano al vencimiento genera acción concreta', () => {
  const resultado = evaluar({ lotes: [lote(100, '2026-10-29')], ventas_netas_30d: 6, registros_ventas_30d: 3 });
  assert.equal(resultado.prioridad, 'alta');
  assert.match(resultado.accion, /Promocionar|liquidar/);
  assert.match(resultado.motivo, /vencimiento/);
});

test('TC-02: prioridad baja indica sin acción prioritaria', () => {
  const resultado = evaluar({ lotes: [lote(40, '2027-06-01')], ventas_netas_30d: 25, registros_ventas_30d: 5 });
  assert.equal(resultado.prioridad, 'baja');
  assert.equal(resultado.accion, 'No requiere acción prioritaria');
});

test('TC-03: devuelve una recomendación con identificación del producto', () => {
  const resultado = evaluar({ lotes: [lote(70, '2026-11-01')] });
  assert.equal(resultado.producto_id, 12);
  assert.equal(resultado.codigo, 'P-012');
  assert.ok(resultado.accion && resultado.motivo);
});

test('TC-04: utiliza demanda neta, stock y vencimiento al decidir', () => {
  const lento = evaluar({ lotes: [lote(50, '2026-10-31')], ventas_netas_30d: 3, registros_ventas_30d: 2 });
  const rapido = evaluar({ lotes: [lote(50, '2026-10-31')], ventas_netas_30d: 600, registros_ventas_30d: 10 });
  assert.equal(lento.prioridad, 'alta');
  assert.notEqual(rapido.tipo_riesgo, 'vencimiento');
  assert.equal(lento.stock_disponible, 50);
  assert.equal(lento.ventas_netas_30_dias, 3);
});

test('TC-05: los productos con riesgo alto conservan prioridad alta', () => {
  const resultado = evaluar({ lotes: [lote(15, '2026-10-27')], ventas_netas_30d: 1, registros_ventas_30d: 1 });
  assert.equal(resultado.prioridad, 'alta');
});

test('TC-06: motivo explica la recomendación', () => {
  const resultado = evaluar({ lotes: [lote(20, '2026-10-20')] });
  assert.match(resultado.motivo, /vencidas/);
  assert.match(resultado.accion, /Retirar/);
  assert.equal(resultado.stock_vencido, 20);
  assert.equal(resultado.stock_disponible, 0);
});

test('TC-07: producto sin prioridad declara explícitamente no actuar', () => {
  const resultado = evaluar({ lotes: [lote(10, null)] });
  assert.equal(resultado.prioridad, 'baja');
  assert.match(resultado.accion, /No requiere acción prioritaria/);
  assert.equal(resultado.demanda_con_historial, false);
});

test('no recomienda vender productos vencidos', () => {
  const resultado = evaluar({ lotes: [lote(10, '2026-10-01')] });
  assert.match(resultado.accion, /Retirar/);
  assert.doesNotMatch(resultado.accion, /liquidar/);
});

test('las ventas netas negativas no generan demanda negativa', () => {
  const resultado = evaluar({ ventas_netas_30d: -9, registros_ventas_30d: 2 });
  assert.equal(resultado.demanda_diaria_estimada, 0);
});

test('riesgo alto de falta de stock propone reponer', () => {
  const resultado = evaluar({ lotes: [lote(2, null)], ventas_netas_30d: 90, registros_ventas_30d: 5 });
  assert.equal(resultado.prioridad, 'alta');
  assert.match(resultado.accion, /reposición/);
});
