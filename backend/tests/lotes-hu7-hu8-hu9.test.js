const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');

const {
  listar,
  obtener,
  crear,
  actualizar,
  historial,
  historialProductos,
  registrarMovimientoCtrl,
} = require('../src/controllers/loteController');

const { Lote, Producto, Categoria, UnidadMedida, MovimientoInventario, Usuario } = require('../src/models');
const { LoteDto } = require('../src/dtos/loteDto');
const { registrarMovimiento } = require('../src/services/kardexService');
const { ErrorKardex, ErrorLote } = require('../src/services/kardexService');
const { validarLoteParaCreacion, calcularEstadoLote, generarCodigoLote } = require('../src/services/loteService');

function mockReqRes(body = {}, params = {}, query = {}, user) {
  let resBody;
  let resStatus = 200;
  // Mock validationResult for express-validator
  const mockValidationResult = {
    isEmpty: () => true,
    array: () => [],
  };
  return {
    req: { body, params, query, user, validationResult: mockValidationResult },
    res: {
      status(s) { resStatus = s; return this; },
      json(b) { resBody = b; return this; },
      getBody() { return resBody; },
      getStatus() { return resStatus; },
    },
    next: (err) => { throw err; },
  };
}

let testUser;

test.beforeEach(async () => {
  await MovimientoInventario.destroy({ where: {}, force: true });
  await Lote.destroy({ where: {}, force: true });
  await Producto.destroy({ where: {}, force: true });
  await Categoria.destroy({ where: {}, force: true });
  await UnidadMedida.destroy({ where: {}, force: true });
  await Usuario.destroy({ where: {}, force: true });
  
  testUser = await Usuario.create({ 
    email: 'test@test.com', 
    nombres: 'Test', 
    apellidos: 'User', 
    password_hash: 'hash', 
    rol_id: 1, 
    activo: true 
  });
});

function userMock() {
  return { id: testUser.id };
}

test('HU7: crear - lote con cantidad 0 → 400', async () => {
  const cat = await Categoria.create({ nombre: 'Cat Test', descripcion: 'Test', vida_util_dias: 365 });
  const um = await UnidadMedida.create({ nombre: 'Test UM', abreviatura: 'TU' });
  const prod = await Producto.create({ codigo: 'P-001', nombre: 'Producto', categoria_id: cat.id, unidad_medida_id: um.id });
  
  const { req, res } = mockReqRes({ producto_id: prod.id, cantidad_inicial: 0 }, {}, {}, userMock());
  await crear(req, res, () => {});
  
  assert.equal(res.getStatus(), 400);
  assert.ok(res.getBody().error.includes('mayor a 0'));
});

test('HU7: crear - lote con cantidad negativa → 400', async () => {
  const cat = await Categoria.create({ nombre: 'Cat Test', descripcion: 'Test', vida_util_dias: 365 });
  const um = await UnidadMedida.create({ nombre: 'Test UM', abreviatura: 'TU' });
  const prod = await Producto.create({ codigo: 'P-001', nombre: 'Producto', categoria_id: cat.id, unidad_medida_id: um.id });
  
  const { req, res } = mockReqRes({ producto_id: prod.id, cantidad_inicial: -5 }, {}, {}, userMock());
  await crear(req, res, () => {});
  
  assert.equal(res.getStatus(), 400);
  assert.ok(res.getBody().error.includes('mayor a 0'));
});

test('HU7: crear - lote sin producto_id → 400', async () => {
  const { req, res } = mockReqRes({ cantidad_inicial: 10 }, {}, {}, userMock());
  await crear(req, res, () => {});
  
  assert.equal(res.getStatus(), 400);
  assert.ok(res.getBody().error.includes('producto_id'));
});

test('HU7: crear - lote con producto_id inválido → 404', async () => {
  const { req, res } = mockReqRes({ producto_id: 999, cantidad_inicial: 10 }, {}, {}, userMock());
  await crear(req, res, () => {});
  
  assert.equal(res.getStatus(), 404);
  assert.ok(res.getBody().error.includes('no encontrado'));
});

test('HU7: crear - lote con producto inactivo → 400', async () => {
  const cat = await Categoria.create({ nombre: 'Cat Test', descripcion: 'Test', vida_util_dias: 365 });
  const um = await UnidadMedida.create({ nombre: 'Test UM', abreviatura: 'TU' });
  const prod = await Producto.create({ codigo: 'P-001', nombre: 'Producto', categoria_id: cat.id, unidad_medida_id: um.id, activo: false });
  
  const { req, res } = mockReqRes({ producto_id: prod.id, cantidad_inicial: 10 }, {}, {}, userMock());
  await crear(req, res, () => {});
  
  assert.equal(res.getStatus(), 400);
  assert.ok(res.getBody().error.includes('inactivo'));
});

test('HU7: crear - lote válido sin fecha_vencimiento → 201 con estado VIGENTE', async () => {
  const cat = await Categoria.create({ nombre: 'Cat Test', descripcion: 'Test', vida_util_dias: 365 });
  const um = await UnidadMedida.create({ nombre: 'Test UM', abreviatura: 'TU' });
  const prod = await Producto.create({ codigo: 'P-001', nombre: 'Producto', categoria_id: cat.id, unidad_medida_id: um.id });
  
  const { req, res } = mockReqRes({ producto_id: prod.id, cantidad_inicial: 100 }, {}, {}, userMock());
  await crear(req, res, () => {});
  
  assert.equal(res.getStatus(), 201);
  const body = res.getBody();
  assert.ok(body.data);
  assert.equal(Number(body.data.cantidad_inicial), 100);
  assert.equal(Number(body.data.cantidad_actual), 100);
  assert.equal(body.data.estado, 'VIGENTE');
  assert.ok(body.data.numero_lote.startsWith('LT-'));
});

test('HU7: actualizar - numero_lote duplicado → 409', async () => {
  const cat = await Categoria.create({ nombre: 'Cat Test', descripcion: 'Test', vida_util_dias: 365 });
  const um = await UnidadMedida.create({ nombre: 'Test UM', abreviatura: 'TU' });
  const prod = await Producto.create({ codigo: 'P-001', nombre: 'Producto', categoria_id: cat.id, unidad_medida_id: um.id });
  
  const lote1 = await Lote.create({ producto_id: prod.id, numero_lote: 'LT-000001', cantidad_inicial: 100, cantidad_actual: 100, fecha_ingreso: new Date() });
  const lote2 = await Lote.create({ producto_id: prod.id, numero_lote: 'LT-000002', cantidad_inicial: 50, cantidad_actual: 50, fecha_ingreso: new Date() });
  
  const { req, res } = mockReqRes({ numero_lote: 'LT-000001' }, { id: lote2.id });
  await actualizar(req, res, () => {});
  
  assert.equal(res.getStatus(), 409);
  assert.ok(res.getBody().error.includes('ya existe'));
});

test('HU8: registrarMovimientoCtrl - ajuste positivo (ingreso + origen ajuste)', async () => {
  const cat = await Categoria.create({ nombre: 'Cat Test', descripcion: 'Test', vida_util_dias: 365 });
  const um = await UnidadMedida.create({ nombre: 'Test UM', abreviatura: 'TU' });
  const prod = await Producto.create({ codigo: 'P-001', nombre: 'Producto', categoria_id: cat.id, unidad_medida_id: um.id });
  const lote = await Lote.create({ producto_id: prod.id, numero_lote: 'LT-000001', cantidad_inicial: 100, cantidad_actual: 0, fecha_ingreso: new Date() });
  await registrarMovimiento(lote.id, 'ingreso', 100, 'inicial', 'Ingreso inicial del lote', null, testUser.id);

  const { req, res } = mockReqRes({ tipo: 'ingreso', cantidad: 10, origen: 'ajuste', motivo: 'Ajuste por inventario físico' }, { id: lote.id }, {}, userMock());
  await registrarMovimientoCtrl(req, res, () => {});

  assert.equal(res.getStatus(), 200);
  const updated = await Lote.findByPk(lote.id);
  assert.equal(Number(updated.cantidad_actual), 110);
});

test('HU8: registrarMovimientoCtrl - ajuste negativo (salida + origen ajuste)', async () => {
  const cat = await Categoria.create({ nombre: 'Cat Test', descripcion: 'Test', vida_util_dias: 365 });
  const um = await UnidadMedida.create({ nombre: 'Test UM', abreviatura: 'TU' });
  const prod = await Producto.create({ codigo: 'P-001', nombre: 'Producto', categoria_id: cat.id, unidad_medida_id: um.id });
  const lote = await Lote.create({ producto_id: prod.id, numero_lote: 'LT-000001', cantidad_inicial: 100, cantidad_actual: 0, fecha_ingreso: new Date() });
  await registrarMovimiento(lote.id, 'ingreso', 100, 'inicial', 'Ingreso inicial del lote', null, testUser.id);

  const { req, res } = mockReqRes({ tipo: 'salida', cantidad: 10, origen: 'ajuste', motivo: 'Ajuste por mermas' }, { id: lote.id }, {}, userMock());
  await registrarMovimientoCtrl(req, res, () => {});

  assert.equal(res.getStatus(), 200);
  const updated = await Lote.findByPk(lote.id);
  assert.equal(Number(updated.cantidad_actual), 90);
});

test('HU8: registrarMovimientoCtrl - tipo "ajuste" legacy se mapea a salida', async () => {
  const cat = await Categoria.create({ nombre: 'Cat Test', descripcion: 'Test', vida_util_dias: 365 });
  const um = await UnidadMedida.create({ nombre: 'Test UM', abreviatura: 'TU' });
  const prod = await Producto.create({ codigo: 'P-001', nombre: 'Producto', categoria_id: cat.id, unidad_medida_id: um.id });
  const lote = await Lote.create({ producto_id: prod.id, numero_lote: 'LT-000001', cantidad_inicial: 100, cantidad_actual: 0, fecha_ingreso: new Date() });
  await registrarMovimiento(lote.id, 'ingreso', 100, 'inicial', 'Ingreso inicial del lote', null, testUser.id);

  const { req, res } = mockReqRes({ tipo: 'ajuste', cantidad: 10, motivo: 'Ajuste legacy' }, { id: lote.id }, {}, userMock());
  await registrarMovimientoCtrl(req, res, () => {});

  assert.equal(res.getStatus(), 200);
  const updated = await Lote.findByPk(lote.id);
  assert.equal(Number(updated.cantidad_actual), 90);
});

test('HU9: listar - filtro fecha_desde y fecha_hasta', async () => {
  const cat = await Categoria.create({ nombre: 'Cat Test', descripcion: 'Test', vida_util_dias: 365 });
  const um = await UnidadMedida.create({ nombre: 'Test UM', abreviatura: 'TU' });
  const prod = await Producto.create({ codigo: 'P-001', nombre: 'Producto', categoria_id: cat.id, unidad_medida_id: um.id });
  
  const ayer = new Date(Date.now() - 86400000);
  const hoy = new Date();
  const manana = new Date(Date.now() + 86400000);
  
  await Lote.create({ producto_id: prod.id, numero_lote: 'LT-000001', cantidad_inicial: 10, cantidad_actual: 10, fecha_ingreso: ayer });
  await Lote.create({ producto_id: prod.id, numero_lote: 'LT-000002', cantidad_inicial: 20, cantidad_actual: 20, fecha_ingreso: hoy });
  await Lote.create({ producto_id: prod.id, numero_lote: 'LT-000003', cantidad_inicial: 30, cantidad_actual: 30, fecha_ingreso: manana });
  
  const { req, res } = mockReqRes({}, {}, { 
    fecha_desde: hoy.toISOString().split('T')[0],
    fecha_hasta: hoy.toISOString().split('T')[0],
  });
  await listar(req, res, () => {});
  
  const data = res.getBody().data;
  assert.equal(data.length, 1);
  assert.equal(Number(data[0].cantidad_inicial), 20);
});

test('HU9: listar - filtro estado=agotado', async () => {
  const cat = await Categoria.create({ nombre: 'Cat Test', descripcion: 'Test', vida_util_dias: 365 });
  const um = await UnidadMedida.create({ nombre: 'Test UM', abreviatura: 'TU' });
  const prod = await Producto.create({ codigo: 'P-001', nombre: 'Producto', categoria_id: cat.id, unidad_medida_id: um.id });
  
  await Lote.create({ producto_id: prod.id, numero_lote: 'LT-000001', cantidad_inicial: 10, cantidad_actual: 10, fecha_ingreso: new Date() });
  await Lote.create({ producto_id: prod.id, numero_lote: 'LT-000002', cantidad_inicial: 20, cantidad_actual: 0, fecha_ingreso: new Date() });
  
  const { req, res } = mockReqRes({}, {}, { estado: 'agotado' });
  await listar(req, res, () => {});
  
  const data = res.getBody().data;
  assert.equal(data.length, 1);
  assert.equal(Number(data[0].cantidad_actual), 0);
});

test('HU9: listar - filtro estado=con_stock', async () => {
  const cat = await Categoria.create({ nombre: 'Cat Test', descripcion: 'Test', vida_util_dias: 365 });
  const um = await UnidadMedida.create({ nombre: 'Test UM', abreviatura: 'TU' });
  const prod = await Producto.create({ codigo: 'P-001', nombre: 'Producto', categoria_id: cat.id, unidad_medida_id: um.id });
  
  await Lote.create({ producto_id: prod.id, numero_lote: 'LT-000001', cantidad_inicial: 10, cantidad_actual: 10, fecha_ingreso: new Date() });
  await Lote.create({ producto_id: prod.id, numero_lote: 'LT-000002', cantidad_inicial: 20, cantidad_actual: 0, fecha_ingreso: new Date() });
  
  const { req, res } = mockReqRes({}, {}, { estado: 'con_stock' });
  await listar(req, res, () => {});
  
  const data = res.getBody().data;
  assert.equal(data.length, 1);
  assert.equal(Number(data[0].cantidad_actual), 10);
});

test('HU9: listar - orden ingreso_asc', async () => {
  const cat = await Categoria.create({ nombre: 'Cat Test', descripcion: 'Test', vida_util_dias: 365 });
  const um = await UnidadMedida.create({ nombre: 'Test UM', abreviatura: 'TU' });
  const prod = await Producto.create({ codigo: 'P-001', nombre: 'Producto', categoria_id: cat.id, unidad_medida_id: um.id });
  
  const ayer = new Date(Date.now() - 86400000);
  const hoy = new Date();
  
  await Lote.create({ producto_id: prod.id, numero_lote: 'LT-000002', cantidad_inicial: 20, cantidad_actual: 20, fecha_ingreso: hoy });
  await Lote.create({ producto_id: prod.id, numero_lote: 'LT-000001', cantidad_inicial: 10, cantidad_actual: 10, fecha_ingreso: ayer });
  
  const { req, res } = mockReqRes({}, {}, { orden: 'ingreso_asc' });
  await listar(req, res, () => {});
  
  const data = res.getBody().data;
  assert.ok(new Date(data[0].fecha_ingreso) <= new Date(data[1].fecha_ingreso));
});

test('HU9: listar - búsqueda numero_lote case insensitive', async () => {
  const cat = await Categoria.create({ nombre: 'Cat Test', descripcion: 'Test', vida_util_dias: 365 });
  const um = await UnidadMedida.create({ nombre: 'Test UM', abreviatura: 'TU' });
  const prod = await Producto.create({ codigo: 'P-001', nombre: 'Producto', categoria_id: cat.id, unidad_medida_id: um.id });
  
  await Lote.create({ producto_id: prod.id, numero_lote: 'LT-000001', cantidad_inicial: 10, cantidad_actual: 10, fecha_ingreso: new Date() });
  
  const { req, res } = mockReqRes({}, {}, { numero_lote: 'lt-000001' });
  await listar(req, res, () => {});
  
  const data = res.getBody().data;
  assert.equal(data.length, 1);
});

test('HU7: registrarMovimiento - salida mayor al stock → 400', async () => {
  const cat = await Categoria.create({ nombre: 'Cat Test', descripcion: 'Test', vida_util_dias: 365 });
  const um = await UnidadMedida.create({ nombre: 'Test UM', abreviatura: 'TU' });
  const prod = await Producto.create({ codigo: 'P-001', nombre: 'Producto', categoria_id: cat.id, unidad_medida_id: um.id });
  const lote = await Lote.create({ producto_id: prod.id, numero_lote: 'LT-000001', cantidad_inicial: 100, cantidad_actual: 100, fecha_ingreso: new Date() });
  
  await assert.rejects(
    registrarMovimiento(lote.id, 'salida', 150, 'ajuste', 'Test', null, 1),
    /Stock insuficiente/
  );
});