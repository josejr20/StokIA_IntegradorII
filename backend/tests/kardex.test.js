const test = require('node:test');
const assert = require('node:assert/strict');

const { Lote, MovimientoInventario, Producto } = require('../src/models');
const { registrarMovimiento } = require('../src/services/kardexService');

const originales = {
  loteFindByPk: Lote.findByPk,
  productoFindByPk: Producto.findByPk,
  movimientoFindOne: MovimientoInventario.findOne,
  movimientoCreate: MovimientoInventario.create,
};

test.afterEach(() => {
  Lote.findByPk = originales.loteFindByPk;
  Producto.findByPk = originales.productoFindByPk;
  MovimientoInventario.findOne = originales.movimientoFindOne;
  MovimientoInventario.create = originales.movimientoCreate;
});

test('registrarMovimiento calcula saldo y costo promedio para un ingreso', async () => {
  const lote = {
    id: 10,
    producto_id: 4,
    cantidad_actual: 10,
    save: async () => {},
  };
  let movimientoCreado;

  Lote.findByPk = async () => lote;
  Producto.findByPk = async () => ({ id: 4, activo: true });
  MovimientoInventario.findOne = async () => ({
    saldo_cantidad: 10,
    saldo_valorizado: 20,
    saldo_precio_unitario: 2,
  });
  MovimientoInventario.create = async (data) => {
    movimientoCreado = data;
    return data;
  };

  const resultado = await registrarMovimiento(10, 'ingreso', 5, 'compra', 'Reposición', 3, 8);

  assert.equal(lote.cantidad_actual, 15);
  assert.equal(resultado.saldo_cantidad, 15);
  assert.equal(resultado.saldo_valorizado, 35);
  assert.equal(resultado.saldo_precio_unitario, 35 / 15);
  assert.equal(movimientoCreado.origen, 'compra');
});

test('registrarMovimiento rechaza una salida mayor al stock simulado', async () => {
  Lote.findByPk = async () => ({ id: 10, producto_id: 4, cantidad_actual: 2 });
  Producto.findByPk = async () => ({ id: 4, activo: true });

  await assert.rejects(
    () => registrarMovimiento(10, 'salida', 3),
    /Stock insuficiente/,
  );
});