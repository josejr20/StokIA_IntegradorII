const test = require('node:test');
const assert = require('node:assert/strict');

const {
  generarCodigoLote,
  validarLoteParaCreacion,
  calcularEstadoLote,
} = require('../src/services/loteService');

test('genera un código de lote en formato LT-000001', () => {
  assert.equal(generarCodigoLote(1), 'LT-000001');
  assert.equal(generarCodigoLote(123), 'LT-000123');
});

test('rechaza lotes con fecha de vencimiento no válida', () => {
  assert.throws(
    () => validarLoteParaCreacion({ cantidad_inicial: 10, fecha_vencimiento: '2020-01-01' }),
    /posterior\s*a\s*hoy/i,
  );

  assert.throws(
    () => validarLoteParaCreacion({ cantidad_inicial: 0, fecha_vencimiento: '2100-01-01' }),
    /mayor\s*a\s*0/i,
  );
});

test('calcula el estado del lote según la fecha de vencimiento', () => {
  const hoy = new Date('2026-09-23T12:00:00Z');

  assert.equal(calcularEstadoLote({ cantidad_actual: 0, fecha_vencimiento: '2026-09-28' }, hoy), 'AGOTADO');
  assert.equal(calcularEstadoLote({ cantidad_actual: 5, fecha_vencimiento: '2026-09-20' }, hoy), 'VENCIDO');
  assert.equal(calcularEstadoLote({ cantidad_actual: 5, fecha_vencimiento: '2026-09-25' }, hoy), 'POR_VENCER');
  assert.equal(calcularEstadoLote({ cantidad_actual: 5, fecha_vencimiento: '2026-10-30' }, hoy), 'VIGENTE');
});
