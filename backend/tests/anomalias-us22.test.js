'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { detectarAnomalias } = require('../src/services/detectorAnomaliasService');

function venta(id, cantidad, producto_id = 1, origen = 'manual') {
  return {
    id, producto_id, cantidad: String(cantidad), origen,
    fecha_venta: new Date(Date.UTC(2026, 9, id)).toISOString(),
  };
}

function movimiento(id, cantidad, lote_id = 15, tipo = 'salida', origen = 'venta') {
  return {
    id, lote_id, tipo, origen, cantidad: String(cantidad),
    fecha: new Date(Date.UTC(2026, 9, id)).toISOString(),
  };
}

test('HU-114: detecta una venta inusualmente alta (TC-01, motor)', () => {
  const ventas = [10, 11, 9, 10, 10, 1000].map((cantidad, i) => venta(i + 1, cantidad));
  const resultado = detectarAnomalias({ ventas });
  assert.equal(resultado.anomalias.length, 1);
  assert.equal(resultado.anomalias[0].registro_id, 6);
  assert.equal(resultado.anomalias[0].fuente, 'venta');
});

test('HU-114: los datos normales no generan falsas anomalias (TC-02, motor)', () => {
  const ventas = [10, 11, 9, 10, 12, 10, 11, 9].map((cantidad, i) => venta(i + 1, cantidad));
  const resultado = detectarAnomalias({ ventas });
  assert.equal(resultado.anomalias.length, 0);
  assert.equal(resultado.resumen.registros_evaluados, 3);
});

test('HU-114: detecta movimiento de inventario via lote y producto', () => {
  const movimientos = [10, 10, 9, 11, 10, 500].map((cantidad, i) => movimiento(i + 1, cantidad));
  const resultado = detectarAnomalias({ movimientos, lotes: [{ id: 15, producto_id: 3 }] });
  assert.equal(resultado.anomalias.length, 1);
  assert.equal(resultado.anomalias[0].producto_id, 3);
  assert.equal(resultado.anomalias[0].fuente, 'movimiento');
});

test('HU-114: distingue series de productos diferentes', () => {
  const ventas = [
    ...[10, 11, 9, 10, 10, 1000].map((cantidad, i) => venta(i + 1, cantidad, 1)),
    ...[100, 102, 98, 100, 101, 103].map((cantidad, i) => venta(i + 1, cantidad, 2)),
  ];
  const resultado = detectarAnomalias({ ventas });
  assert.deepEqual(resultado.anomalias.map((a) => a.producto_id), [1]);
});

test('HU-114: no declara anomalias sin una base historica suficiente', () => {
  const ventas = [10, 10, 1000].map((cantidad, i) => venta(i + 1, cantidad));
  const resultado = detectarAnomalias({ ventas });
  assert.equal(resultado.anomalias.length, 0);
  assert.equal(resultado.resumen.registros_sin_historial_suficiente, 3);
});

test('HU-114: ignora devoluciones/anulaciones para no contaminar la serie de ventas', () => {
  const ventas = [10, 10, 10, 10, 10].map((cantidad, i) => venta(i + 1, cantidad));
  ventas.push(venta(6, -1000, 1, 'devolucion'));
  ventas.push(venta(7, 10, 1, 'importado'));
  const resultado = detectarAnomalias({ ventas });
  assert.equal(resultado.anomalias.length, 0);
  assert.equal(resultado.resumen.registros_omitidos, 1);
});

test('HU-114: reporta movimientos sin relacion producto-lote en lugar de inventarla', () => {
  const resultado = detectarAnomalias({ movimientos: [movimiento(1, 300)] });
  assert.equal(resultado.resumen.registros_omitidos, 1);
  assert.equal(resultado.omitidos[0].motivo, 'producto_no_identificado');
});

test('HU-114: el valor anomalo no altera la mediana de las ventas siguientes', () => {
  const ventas = [10, 10, 10, 10, 10, 1000, 11].map((cantidad, i) => venta(i + 1, cantidad));
  const resultado = detectarAnomalias({ ventas });
  assert.equal(resultado.anomalias.length, 1);
  assert.equal(resultado.anomalias[0].registro_id, 6);
});

test('HU-114: los movimientos tipo ajuste no se mezclan con salidas por venta', () => {
  const movimientos = [10, 10, 10, 10, 10].map((cantidad, i) => movimiento(i + 1, cantidad));
  movimientos.push(movimiento(6, 1000, 15, 'ajuste', 'ajuste'));
  const resultado = detectarAnomalias({ movimientos, lotes: [{ id: 15, producto_id: 2 }] });
  assert.equal(resultado.anomalias.length, 0);
  assert.equal(resultado.resumen.registros_sin_historial_suficiente, 6);
});
