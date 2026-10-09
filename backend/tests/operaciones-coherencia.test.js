const test = require('node:test');
const assert = require('node:assert/strict');
const models = require('../src/models');
const {
  Operacion,
  OperacionDetalle,
  Comprobante,
  Configuracion,
  Cliente,
  Producto,
  Lote,
  Venta,
  Auditoria,
  MovimientoInventario,
  Usuario,
} = models;
const {
  ErrorOperacion,
  anularOperacion,
  crearOperacion,
  puedeAnularOperacion,
  reconstruirDatosComprobante,
} = require('../src/services/operacionService');

const nombresMetodos = [
  [Operacion, ['findByPk', 'findOne', 'findAll', 'create']],
  [OperacionDetalle, ['findAll', 'create']],
  [Comprobante, ['create']],
  [Configuracion, ['findOne']],
  [Cliente, ['findByPk']],
  [Producto, ['findAll', 'findByPk']],
  [Lote, ['findByPk', 'findAll', 'max', 'create']],
  [Venta, ['findAll', 'create']],
  [Auditoria, ['create']],
  [MovimientoInventario, ['findAll', 'create']],
  [Usuario, ['findByPk']],
];
const metodosOriginales = nombresMetodos.flatMap(([modelo, metodos]) =>
  metodos.map((metodo) => [modelo, metodo, modelo[metodo]]),
);
const transaccionOriginal = Operacion.sequelize.transaction;

let origen;
let detallesOrigen;
let lotes;
let filasKardex;
let detallesCreados;
let ventasCreadas;
let ventasOriginales;
let operacionCreada;
let numeroOperaciones;
let cancelarTransaccion;

test.beforeEach(() => {
  detallesOrigen = [
    { id: 1, operacion_id: 10, producto_id: 5, lote_id: 1, cantidad: 1, precio_unitario: 5 },
    { id: 2, operacion_id: 10, producto_id: 5, lote_id: 2, cantidad: 1, precio_unitario: 5 },
  ];
  origen = {
    id: 10,
    numero: 'V-000010',
    tipo: 'venta',
    estado: 'activa',
    cliente_id: 8,
    fecha: new Date('2026-01-01T12:00:00Z'),
    fecha_creacion: new Date(),
    save: async function () {},
  };
  lotes = new Map([
    [1, { id: 1, producto_id: 5, cantidad_actual: 0, fecha_vencimiento: null, save: async function () {} }],
    [2, { id: 2, producto_id: 5, cantidad_actual: 0, fecha_vencimiento: null, save: async function () {} }],
  ]);
  filasKardex = [
    {
      id: 1, lote_id: 1, tipo: 'ingreso', cantidad: 10, precio_unitario: 2,
      costo_unitario_manual: true, fecha: new Date('2025-12-30T12:00:00Z'),
      update: async function (values) { Object.assign(this, values); },
    },
    {
      id: 2, lote_id: 1, tipo: 'salida', cantidad: 1, precio_unitario: 2,
      costo_unitario_manual: false, fecha: new Date('2026-01-01T12:00:00Z'),
      update: async function (values) { Object.assign(this, values); },
    },
    {
      id: 3, lote_id: 2, tipo: 'salida', cantidad: 1, precio_unitario: 2,
      costo_unitario_manual: false, fecha: new Date('2026-01-01T12:00:00Z'),
      update: async function (values) { Object.assign(this, values); },
    },
  ];
  detallesCreados = [];
  ventasCreadas = [];
  ventasOriginales = [
    { id: 1, operacion_id: 10, producto_id: 5, lote_id: 1, cantidad: 1, precio_unitario: 5 },
    { id: 2, operacion_id: 10, producto_id: 5, lote_id: 2, cantidad: 1, precio_unitario: 5 },
  ];
  operacionCreada = null;
  numeroOperaciones = 0;
  cancelarTransaccion = false;

  Operacion.sequelize.transaction = async () => ({
    LOCK: { UPDATE: 'UPDATE' },
    commit: async () => {},
    rollback: async () => { cancelarTransaccion = true; },
  });
  Operacion.findOne = async () => null;
  Operacion.findByPk = async (id) => Number(id) === 10 ? origen : operacionCreada;
  Operacion.findAll = async () => [];
  Operacion.create = async (data) => {
    operacionCreada = {
      id: 20,
      numero: null,
      numero_comprobante: null,
      save: async function () {},
      ...data,
    };
    return operacionCreada;
  };
  OperacionDetalle.findAll = async ({ where }) =>
    Number(where.operacion_id) === 10 ? detallesOrigen : [];
  OperacionDetalle.create = async (data) => {
    const detail = { id: detallesCreados.length + 1, ...data };
    detallesCreados.push(detail);
    return detail;
  };
  Comprobante.create = async (data) => ({ id: 1, save: async function () {}, ...data });
  Configuracion.findOne = async () => null;
  Cliente.findByPk = async (id) => ({ id: Number(id), activo: true, nombre: 'Cliente', documento: null });
  Producto.findAll = async () => [{ id: 5, codigo: 'P-005', nombre: 'Producto', activo: true, precio_venta: 5 }];
  Producto.findByPk = async () => ({ id: 5, activo: true });
  Lote.findByPk = async (id) => lotes.get(Number(id)) || null;
  Lote.findAll = async () => [...lotes.values()];
  Venta.create = async (data) => {
    const venta = { id: ventasCreadas.length + 1, ...data };
    ventasCreadas.push(venta);
    return venta;
  };
  Venta.findAll = async () => ventasOriginales;
  Auditoria.create = async () => ({});
  MovimientoInventario.findAll = async () =>
    [...filasKardex].sort((a, b) => new Date(a.fecha) - new Date(b.fecha) || a.id - b.id);
  MovimientoInventario.create = async (data) => {
    const movimiento = {
      id: filasKardex.length + 1,
      ...data,
      update: async function (values) { Object.assign(this, values); },
      reload: async function () {},
    };
    filasKardex.push(movimiento);
    return movimiento;
  };
  Usuario.findByPk = async () => ({ id: 9, nombres: 'Vendedor', apellidos: 'Prueba', email: 'test@example.com' });
});

test.afterEach(() => {
  for (const [modelo, metodo, original] of metodosOriginales) modelo[metodo] = original;
  Operacion.sequelize.transaction = transaccionOriginal;
});

test('devolución parcial conserva el lote de la venta y resta del saldo vendible', async () => {
  const resultado = await crearOperacion({
    tipo: 'devolucion',
    cliente_id: 8,
    items: [{ producto_id: 5, cantidad: 1.5, precio_unitario: 5 }],
    fecha: new Date('2026-02-01T12:00:00Z'),
    motivo: 'Producto devuelto',
    operacion_origen_id: 10,
    usuario_id: 9,
  });

  assert.equal(resultado.operacion.id, 20);
  assert.deepEqual(
    detallesCreados.map(({ lote_id, cantidad }) => [lote_id, cantidad]),
    [[1, 1], [2, 0.5]],
  );
  assert.deepEqual(
    ventasCreadas.map(({ operacion_id, lote_id, cantidad, origen }) => [operacion_id, lote_id, cantidad, origen]),
    [[20, 1, -1, 'devolucion'], [20, 2, -0.5, 'devolucion']],
  );
  assert.equal(operacionCreada.operacion_origen_id, 10);
});

test('rechaza devolver más unidades que las disponibles en la venta original', async () => {
  await assert.rejects(
    crearOperacion({
      tipo: 'devolucion',
      cliente_id: 8,
      items: [{ producto_id: 5, cantidad: 2.01, precio_unitario: 5 }],
      fecha: new Date('2026-02-01T12:00:00Z'),
      motivo: 'Devolución excedida',
      operacion_origen_id: 10,
      usuario_id: 9,
    }),
    (error) => error instanceof ErrorOperacion && /supera la cantidad vendida/.test(error.message),
  );
  assert.equal(cancelarTransaccion, true);
  assert.equal(operacionCreada, null);
});

test('rechaza devoluciones sin venta original o de otro cliente', async () => {
  await assert.rejects(
    crearOperacion({
      tipo: 'devolucion',
      cliente_id: 8,
      items: [{ producto_id: 5, cantidad: 1, precio_unitario: 5 }],
      motivo: 'Devolución sin origen',
      usuario_id: 9,
    }),
    (error) => error instanceof ErrorOperacion && /vincular la venta original/.test(error.message),
  );

  await assert.rejects(
    crearOperacion({
      tipo: 'devolucion',
      cliente_id: 7,
      items: [{ producto_id: 5, cantidad: 1, precio_unitario: 5 }],
      fecha: new Date('2026-02-01T12:00:00Z'),
      motivo: 'Cliente incorrecto',
      operacion_origen_id: 10,
      usuario_id: 9,
    }),
    (error) => error instanceof ErrorOperacion && /pertenece a otro cliente/.test(error.message),
  );
});

test('rechaza la venta con un lote vencido indicado explícitamente', async () => {
  lotes.set(1, {
    id: 1,
    producto_id: 5,
    cantidad_actual: 3,
    fecha_vencimiento: '2026-01-15',
    save: async function () {},
  });
  await assert.rejects(
    crearOperacion({
      tipo: 'venta',
      cliente_id: 8,
      items: [{ producto_id: 5, lote_id: 1, cantidad: 1, precio_unitario: 5 }],
      fecha: new Date('2026-02-01T12:00:00Z'),
      usuario_id: 9,
    }),
    (error) => error instanceof ErrorOperacion && /lote.*vencido/i.test(error.message),
  );
  assert.equal(operacionCreada, null);
});

test('anular una venta revierte los lotes y netea las filas de ventas', async () => {
  const resultado = await anularOperacion(10, 9);

  assert.equal(resultado.estado, 'anulada');
  assert.deepEqual(
    ventasCreadas.map(({ operacion_id, lote_id, cantidad, origen }) => [operacion_id, lote_id, cantidad, origen]),
    [[10, 1, -1, 'anulacion'], [10, 2, -1, 'anulacion']],
  );
  assert.equal(lotes.get(1).cantidad_actual, 1);
  assert.equal(lotes.get(2).cantidad_actual, 1);
});

test('la anulación vence al cumplir 48 horas desde la creación', async () => {
  const ahora = Date.now();
  assert.equal(
    puedeAnularOperacion({ fecha_creacion: new Date(ahora - 48 * 60 * 60 * 1000) }, ahora),
    false,
  );
  assert.equal(
    puedeAnularOperacion({ fecha_creacion: new Date(ahora - 48 * 60 * 60 * 1000 + 1) }, ahora),
    true,
  );

  origen.fecha_creacion = new Date(ahora - 48 * 60 * 60 * 1000);
  await assert.rejects(
    anularOperacion(10, 9),
    (error) => error instanceof ErrorOperacion && /primeras 48 horas/.test(error.message),
  );
  assert.equal(cancelarTransaccion, true);
  assert.deepEqual(ventasCreadas, []);
});

test('reconstruye comprobantes antiguos con precio, totales, fecha y vendedor de sus registros', () => {
  const datos = reconstruirDatosComprobante(
    {
      id: 15,
      numero: 'V-000015',
      fecha: 'fecha inválida',
      fecha_creacion: '2026-01-02T10:30:00.000Z',
      subtotal: 0,
      impuesto_porcentaje: 0,
      impuesto: 0,
      total: 0,
      cliente: { id: 8, nombre: 'Judith Gutiérrez', documento: '123' },
      usuario: { id: 9, nombres: 'José', apellidos: 'Pérez', email: 'jose@example.com' },
      detalles: [{
        producto_id: 5,
        lote_id: 1,
        cantidad: 2,
        precio_unitario: 0,
        subtotal: 0,
        producto: { codigo: '381', nombre: 'Producto prueba', precio_venta: 12.5 },
      }],
    },
    {
      numero: 'NC-000015',
      tipo: 'nota_credito',
      fecha_creacion: '2026-01-02T10:31:00.000Z',
      datos: {
        numero_operacion: '',
        numero_comprobante: 'NC-000015',
        fecha: 'Invalid Date',
        items: [{ producto_id: 5, lote_id: 1, cantidad: 2, precio_unitario: 0, subtotal: 0 }],
        subtotal: 0,
        impuesto_porcentaje: 0,
        impuesto: 0,
        total: 0,
      },
    },
    [],
  );

  assert.equal(datos.numero_operacion, 'V-000015');
  assert.equal(datos.fecha, '2026-01-02T10:30:00.000Z');
  assert.equal(datos.cliente.nombre, 'Judith Gutiérrez');
  assert.equal(datos.vendedor.nombres, 'José');
  assert.deepEqual(
    [datos.items[0].codigo, datos.items[0].precio_unitario, datos.items[0].subtotal],
    ['381', 12.5, 25],
  );
  assert.deepEqual([datos.subtotal, datos.impuesto, datos.total], [25, 0, 25]);

  const precioVenta = reconstruirDatosComprobante(
    {
      id: 15,
      numero: 'V-000015',
      subtotal: 0,
      impuesto_porcentaje: 0,
      impuesto: 0,
      total: 0,
      detalles: [{
        producto_id: 5,
        lote_id: 1,
        cantidad: 2,
        precio_unitario: 0,
        subtotal: 0,
        producto: { codigo: '381', nombre: 'Producto prueba', precio_venta: 12.5 },
      }],
    },
    { numero: 'NC-000015', tipo: 'nota_credito', datos: {} },
    [{ producto_id: 5, lote_id: 1, cantidad: 2, precio_unitario: 9, origen: 'manual' }],
  );
  assert.deepEqual(
    [precioVenta.items[0].precio_unitario, precioVenta.total],
    [9, 18],
  );
});

test('no permite anular una venta con devoluciones activas', async () => {
  Operacion.findOne = async ({ where }) =>
    where.operacion_origen_id ? { id: 30 } : null;

  await assert.rejects(
    anularOperacion(10, 9),
    (error) => error instanceof ErrorOperacion && /devoluciones activas/.test(error.message),
  );
  assert.equal(cancelarTransaccion, true);
  assert.deepEqual(ventasCreadas, []);
});
