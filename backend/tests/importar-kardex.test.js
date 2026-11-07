'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  clasificarMotivo,
  crearIndiceProductos,
  limitarMotivo,
  obtenerProductoId,
  prioridadMotivo,
} = require('../src/utils/importarKardex');

test('resuelve productos por su descripción actual sin depender de IDs fijos', () => {
  const indice = crearIndiceProductos([
    {
      id: 9876,
      nombre: 'Producto de catálogo',
      descripcion: 'AJI-NO-MEN CARNE 80 GR X24 SOBRES',
    },
  ]);

  assert.deepEqual(
    obtenerProductoId('  ají-no-men   carne 80 gr x24 sobres ', indice),
    { productoId: 9876 },
  );
});

test('usa el mapeo legado solo cuando el producto aún existe', () => {
  const indice = crearIndiceProductos(
    [{ id: 15, nombre: 'Producto', descripcion: null }],
    { 'Presentación histórica': 15, 'ID obsoleto': 1458 },
  );

  assert.deepEqual(obtenerProductoId('presentación histórica', indice), { productoId: 15 });
  assert.deepEqual(obtenerProductoId('ID obsoleto', indice), { productoId: null });
});

test('reporta presentaciones ambiguas en vez de asignarlas a un producto arbitrario', () => {
  const indice = crearIndiceProductos([
    { id: 1, nombre: 'Producto A', descripcion: 'Presentación duplicada' },
    { id: 2, nombre: 'Producto B', descripcion: 'PRESENTACIÓN DUPLICADA' },
  ]);

  assert.deepEqual(obtenerProductoId('Presentación duplicada', indice), { ambiguo: true });
});

test('clasifica ingresos por compra/devolución y ordena movimientos históricos', () => {
  assert.equal(clasificarMotivo('Ingreso por compra'), 'compra');
  assert.equal(clasificarMotivo('Ingreso de disponible/real por compra'), 'compra');
  assert.equal(clasificarMotivo('Ingreso por devolución en una venta'), 'devolucion');
  assert.equal(prioridadMotivo('Ingreso por compra'), 0);
  assert.equal(prioridadMotivo('Salida por generación de pedido a venta'), 1);
  assert.equal(prioridadMotivo('Ingreso por devolución en una venta'), 2);
});

test('limita el motivo al tamaño permitido por el Kardex', () => {
  assert.equal(limitarMotivo('x'.repeat(250)).length, 200);
});
