'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validarStockMinimo,
  minimoPredeterminado,
  evaluarStock
} = require('../src/services/reglasStockMinimo');

test('TC-01: el minimo 10 se acepta y conserva', () => assert.equal(validarStockMinimo(10), 10));
test('TC-02: sin configuracion se aplica 10 por defecto', () => {
  const anterior = process.env.STOCK_MINIMO_PREDETERMINADO;
  try {
    delete process.env.STOCK_MINIMO_PREDETERMINADO;
    assert.equal(minimoPredeterminado(), 10);
  } finally {
    if (anterior === undefined) delete process.env.STOCK_MINIMO_PREDETERMINADO;
    else process.env.STOCK_MINIMO_PREDETERMINADO = anterior;
  }
});
test('TC-03: permite minimos distintos por producto', () => {
  assert.equal(evaluarStock(5, 10).bajo_stock, true);
  assert.equal(evaluarStock(5, 3).bajo_stock, false);
});
test('TC-04: si la existencia es menor al minimo indica bajo stock', () => {
  assert.deepEqual(evaluarStock(5, 10), {
    stock_disponible: 5, stock_minimo: 10, bajo_stock: true, faltante: 5
  });
});
test('TC-05: rechaza cero y negativos', () => {
  assert.throws(() => validarStockMinimo(0));
  assert.throws(() => validarStockMinimo(-3));
});
test('TC-05: rechaza texto, NaN y exceso de decimales', () => {
  for (const valor of ['abc', '', '1.001', Number.NaN, null]) {
    assert.throws(() => validarStockMinimo(valor));
  }
});
test('TC-06: permite configurar el valor general por entorno', () => {
  const anterior = process.env.STOCK_MINIMO_PREDETERMINADO;
  try {
    process.env.STOCK_MINIMO_PREDETERMINADO = '6';
    assert.equal(minimoPredeterminado(), 6);
  } finally {
    if (anterior === undefined) delete process.env.STOCK_MINIMO_PREDETERMINADO;
    else process.env.STOCK_MINIMO_PREDETERMINADO = anterior;
  }
});
test('TC-07: valor decimal valido queda normalizado', () => assert.equal(validarStockMinimo('7.50'), 7.5));
test('sin alerta al alcanzar exactamente el minimo', () => assert.equal(evaluarStock(10, 10).bajo_stock, false));
test('se calcula el faltante correctamente', () => assert.equal(evaluarStock(2.5, 7).faltante, 4.5));
