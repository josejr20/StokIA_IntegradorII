const test = require('node:test');
const assert = require('node:assert/strict');

const { Lote, MovimientoInventario, Producto } = require('../src/models');
const { registrarMovimiento } = require('../src/services/kardexService');

const originales = {
  loteFindByPk: Lote.findByPk,
  productoFindByPk: Producto.findByPk,
  movimientoFindAll: MovimientoInventario.findAll,
  movimientoCreate: MovimientoInventario.create,
  sequelizeTransaction: Lote.sequelize.transaction,
};

test.afterEach(() => {
  Lote.findByPk = originales.loteFindByPk;
  Producto.findByPk = originales.productoFindByPk;
  MovimientoInventario.findAll = originales.movimientoFindAll;
  MovimientoInventario.create = originales.movimientoCreate;
  Lote.sequelize.transaction = originales.sequelizeTransaction;
});

test('registrarMovimiento calcula saldo y costo promedio para un ingreso', async () => {
  const lote = {
    id: 10,
    producto_id: 4,
    cantidad_actual: 10,
    save: async () => {},
  };
  const movimientos = [{
    tipo: 'ingreso',
    cantidad: 10,
    precio_unitario: 2,
    costo_unitario_manual: true,
    saldo_cantidad: 10,
    saldo_valorizado: 20,
    saldo_precio_unitario: 2,
    update: async function (data) { Object.assign(this, data); },
  }];
  const transaction = {
    LOCK: { UPDATE: 'UPDATE' },
    commit: async () => {},
    rollback: async () => {},
  };
  let movimientoCreado;

  Lote.sequelize.transaction = async () => transaction;
  Lote.findByPk = async () => lote;
  Producto.findByPk = async () => ({ id: 4, activo: true });
  MovimientoInventario.findAll = async () => movimientos;
  MovimientoInventario.create = async (data) => {
    movimientoCreado = {
      ...data,
      update: async function (updates) { Object.assign(this, updates); },
      reload: async function () {},
    };
    movimientos.push(movimientoCreado);
    return movimientoCreado;
  };

  const resultado = await registrarMovimiento(10, 'ingreso', 5, 'compra', 'Reposición', 3, 8);

  assert.equal(lote.cantidad_actual, 15);
  assert.equal(resultado.saldo_cantidad, 15);
  assert.equal(resultado.saldo_valorizado, 35);
  assert.equal(resultado.saldo_precio_unitario, 2.33);
  assert.equal(movimientoCreado.origen, 'compra');
});

test('registrarMovimiento rechaza una salida mayor al stock simulado', async () => {
  Lote.sequelize.transaction = async () => ({
    LOCK: { UPDATE: 'UPDATE' },
    commit: async () => {},
    rollback: async () => {},
  });
  Lote.findByPk = async () => ({ id: 10, producto_id: 4, cantidad_actual: 2 });
  Producto.findByPk = async () => ({ id: 4, activo: true });

  await assert.rejects(
    () => registrarMovimiento(10, 'salida', 3),
    /Stock insuficiente/,
  );
});

test('registrarMovimiento recalcula los saldos al insertar un movimiento histórico', async () => {
  const fecha = (value) => new Date(`${value}T12:00:00Z`);
  const lote = {
    id: 10,
    producto_id: 4,
    cantidad_actual: 8,
    save: async () => {},
  };
  const salida = {
    id: 2,
    lote_id: 10,
    tipo: 'salida',
    cantidad: 2,
    precio_unitario: 2,
    costo_unitario_manual: false,
    fecha: fecha('2026-01-03'),
    update: async function (data) { Object.assign(this, data); },
  };
  const movimientos = [{
    id: 1,
    lote_id: 10,
    tipo: 'ingreso',
    cantidad: 10,
    precio_unitario: 2,
    costo_unitario_manual: true,
    fecha: fecha('2026-01-01'),
    update: async function (data) { Object.assign(this, data); },
  }, salida];
  Lote.sequelize.transaction = async () => ({
    LOCK: { UPDATE: 'UPDATE' },
    commit: async () => {},
    rollback: async () => {},
  });
  Lote.findByPk = async () => lote;
  Producto.findByPk = async () => ({ id: 4, activo: true });
  MovimientoInventario.findAll = async () =>
    [...movimientos].sort((a, b) => a.fecha - b.fecha || a.id - b.id);
  MovimientoInventario.create = async (data) => {
    const movimiento = {
      ...data,
      id: 3,
      update: async function (updates) { Object.assign(this, updates); },
      reload: async function () {},
    };
    movimientos.push(movimiento);
    return movimiento;
  };

  await registrarMovimiento(10, 'ingreso', 5, 'compra', 'Ingreso con fecha anterior', 3, 8, null, fecha('2026-01-02'));

  assert.equal(lote.cantidad_actual, 13);
  assert.equal(salida.saldo_cantidad, 13);
  assert.equal(salida.precio_total, 4.66);
  assert.equal(salida.saldo_valorizado, 30.34);
});