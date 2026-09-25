const test = require('node:test');
const assert = require('node:assert/strict');

const {
  calcularEstadoLote,
  seleccionarLotesFEFO,
  validarLoteParaCreacion,
} = require('../src/services/loteService');

const hoy = new Date('2026-09-23T12:00:00Z');

test('calcularEstadoLote distingue agotado, vencido, por vencer y vigente', () => {
  assert.equal(calcularEstadoLote({ cantidad_actual: 0, fecha_vencimiento: '2026-12-01' }, hoy), 'AGOTADO');
  assert.equal(calcularEstadoLote({ cantidad_actual: 2, fecha_vencimiento: '2026-09-20' }, hoy), 'VENCIDO');
  assert.equal(calcularEstadoLote({ cantidad_actual: 2, fecha_vencimiento: '2026-09-25' }, hoy), 'POR_VENCER');
  assert.equal(calcularEstadoLote({ cantidad_actual: 2, fecha_vencimiento: '2026-12-01' }, hoy), 'VIGENTE');
});

test('seleccionarLotesFEFO excluye agotados y vencidos y ordena por vencimiento', () => {
  const seleccionados = seleccionarLotesFEFO([
    { id: 1, cantidad_actual: 0, fecha_vencimiento: '2026-09-25' },
    { id: 2, cantidad_actual: 4, fecha_vencimiento: '2026-10-10' },
    { id: 3, cantidad_actual: 4, fecha_vencimiento: '2026-09-20' },
    { id: 4, cantidad_actual: 4, fecha_vencimiento: '2026-09-30' },
  ], hoy);

  assert.deepEqual(seleccionados.map((lote) => lote.id), [4, 2]);
});

test('validarLoteParaCreacion devuelve cantidad y fecha normalizadas', () => {
  assert.deepEqual(
    validarLoteParaCreacion({ cantidad_inicial: '12.5', fecha_vencimiento: '2099-01-02' }),
    { cantidad_inicial: 12.5, fecha_vencimiento: '2099-01-02' },
  );
});