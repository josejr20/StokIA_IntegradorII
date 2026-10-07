const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');

const { listar, resumen } = require('../src/controllers/ventaController');
const { Venta, Producto, Categoria, UnidadMedida, Cliente, Usuario } = require('../src/models');
const { VentaDto } = require('../src/dtos/ventaDto');

function mockReqRes(body = {}, params = {}, query = {}, user) {
  let resBody;
  let resStatus = 200;
  return {
    req: { body, params, query, user },
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
  await Venta.destroy({ where: {}, force: true });
  await Producto.destroy({ where: {}, force: true });
  await Categoria.destroy({ where: {}, force: true });
  await UnidadMedida.destroy({ where: {}, force: true });
  await Cliente.destroy({ where: {}, force: true });
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

test('HU10: listar - filtro fecha_desde y fecha_hasta', async () => {
  const cat = await Categoria.create({ nombre: 'Cat Test', descripcion: 'Test', vida_util_dias: 365 });
  const um = await UnidadMedida.create({ nombre: 'Test UM', abreviatura: 'TU' });
  const prod = await Producto.create({ codigo: 'P-001', nombre: 'Producto', categoria_id: cat.id, unidad_medida_id: um.id });
  const cliente = await Cliente.create({ nombre: 'Cliente Test', documento: '12345678', activo: true });
  
  const hoy = new Date();
  const hoyStr = hoy.toISOString().split('T')[0];
  
  const fechaVenta = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 12, 0, 0);
  
  await Venta.create({ producto_id: prod.id, cantidad: 10, precio_unitario: 100, fecha_venta: fechaVenta, origen: 'manual', usuario_id: testUser.id });
  await Venta.create({ producto_id: prod.id, cantidad: 20, precio_unitario: 150, fecha_venta: fechaVenta, origen: 'manual', usuario_id: testUser.id });
  await Venta.create({ producto_id: prod.id, cantidad: 30, precio_unitario: 200, fecha_venta: fechaVenta, origen: 'manual', usuario_id: testUser.id });
  
  const { req, res } = mockReqRes({}, {}, { 
    fecha_desde: hoyStr,
    fecha_hasta: hoyStr,
  }, userMock());
  await listar(req, res, () => {});
  
  const data = res.getBody().data;
  assert.equal(data.length, 3);
  // Verify all 3 ventas are returned (order may vary since same fecha_venta)
  const cantidades = data.map(d => Number(d.cantidad)).sort((a, b) => a - b);
  assert.deepEqual(cantidades, [10, 20, 30]);
});

test('HU10: listar - filtro por producto', async () => {
  const cat = await Categoria.create({ nombre: 'Cat Test', descripcion: 'Test', vida_util_dias: 365 });
  const um = await UnidadMedida.create({ nombre: 'Test UM', abreviatura: 'TU' });
  const prod1 = await Producto.create({ codigo: 'P-001', nombre: 'Producto 1', categoria_id: cat.id, unidad_medida_id: um.id });
  const prod2 = await Producto.create({ codigo: 'P-002', nombre: 'Producto 2', categoria_id: cat.id, unidad_medida_id: um.id });
  const cliente = await Cliente.create({ nombre: 'Cliente Test', documento: '12345678', activo: true });
  
  await Venta.create({ producto_id: prod1.id, cantidad: 10, precio_unitario: 100, fecha_venta: new Date(), origen: 'manual', usuario_id: testUser.id });
  await Venta.create({ producto_id: prod2.id, cantidad: 20, precio_unitario: 150, fecha_venta: new Date(), origen: 'manual', usuario_id: testUser.id });
  
  const { req, res } = mockReqRes({}, {}, { producto: prod1.id }, userMock());
  await listar(req, res, () => {});
  
  const data = res.getBody().data;
  assert.equal(data.length, 1);
  assert.equal(data[0].producto_id, prod1.id);
});

test('HU10: listar - filtro por origen', async () => {
  const cat = await Categoria.create({ nombre: 'Cat Test', descripcion: 'Test', vida_util_dias: 365 });
  const um = await UnidadMedida.create({ nombre: 'Test UM', abreviatura: 'TU' });
  const prod = await Producto.create({ codigo: 'P-001', nombre: 'Producto', categoria_id: cat.id, unidad_medida_id: um.id });
  
  await Venta.create({ producto_id: prod.id, cantidad: 10, precio_unitario: 100, fecha_venta: new Date(), origen: 'manual', usuario_id: testUser.id });
  await Venta.create({ producto_id: prod.id, cantidad: 20, precio_unitario: 150, fecha_venta: new Date(), origen: 'importado', usuario_id: testUser.id });
  
  const { req, res } = mockReqRes({}, {}, { origen: 'importado' }, userMock());
  await listar(req, res, () => {});
  
  const data = res.getBody().data;
  assert.equal(data.length, 1);
  assert.equal(data[0].origen, 'importado');
});

test('HU10: resumen - totales con ventas netas (manual + importado)', async () => {
  const cat = await Categoria.create({ nombre: 'Cat Test', descripcion: 'Test', vida_util_dias: 365 });
  const um = await UnidadMedida.create({ nombre: 'Test UM', abreviatura: 'TU' });
  const prod = await Producto.create({ codigo: 'P-001', nombre: 'Producto', categoria_id: cat.id, unidad_medida_id: um.id });
  
  await Venta.create({ producto_id: prod.id, cantidad: 10, precio_unitario: 100, fecha_venta: new Date(), origen: 'manual', usuario_id: testUser.id });
  await Venta.create({ producto_id: prod.id, cantidad: 20, precio_unitario: 150, fecha_venta: new Date(), origen: 'importado', usuario_id: testUser.id });
  await Venta.create({ producto_id: prod.id, cantidad: 5, precio_unitario: 50, fecha_venta: new Date(), origen: 'devolucion', usuario_id: testUser.id });
  
  const { req, res } = mockReqRes({}, {}, {}, userMock());
  await resumen(req, res, () => {});
  
  const body = res.getBody();
  assert.equal(res.getStatus(), 200);
  assert.equal(body.data.total_cantidad, 30); // 10 + 20 (solo manual + importado)
  assert.equal(body.data.total_monto, 10 * 100 + 20 * 150); // 1000 + 3000 = 4000
  assert.deepEqual(body.data.origenes_incluidos, ['manual', 'importado']);
});

test('HU10: resumen - con incluir_ajustes=true suma devolucion y anulacion', async () => {
  const cat = await Categoria.create({ nombre: 'Cat Test', descripcion: 'Test', vida_util_dias: 365 });
  const um = await UnidadMedida.create({ nombre: 'Test UM', abreviatura: 'TU' });
  const prod = await Producto.create({ codigo: 'P-001', nombre: 'Producto', categoria_id: cat.id, unidad_medida_id: um.id });
  
  await Venta.create({ producto_id: prod.id, cantidad: 10, precio_unitario: 100, fecha_venta: new Date(), origen: 'manual', usuario_id: testUser.id });
  await Venta.create({ producto_id: prod.id, cantidad: 20, precio_unitario: 150, fecha_venta: new Date(), origen: 'importado', usuario_id: testUser.id });
  await Venta.create({ producto_id: prod.id, cantidad: 5, precio_unitario: 50, fecha_venta: new Date(), origen: 'devolucion', usuario_id: testUser.id });
  
  const { req, res } = mockReqRes({}, {}, { incluir_ajustes: 'true' }, userMock());
  await resumen(req, res, () => {});
  
  const body = res.getBody();
  assert.equal(res.getStatus(), 200);
  assert.equal(body.data.total_cantidad, 35); // 10 + 20 + 5
  assert.equal(body.data.total_monto, 10 * 100 + 20 * 150 + 5 * 50); // 1000 + 3000 + 250 = 4250
  assert.deepEqual(body.data.origenes_incluidos, ['manual', 'importado', 'devolucion', 'anulacion']);
});

test('HU10: resumen - filtro por producto', async () => {
  const cat = await Categoria.create({ nombre: 'Cat Test', descripcion: 'Test', vida_util_dias: 365 });
  const um = await UnidadMedida.create({ nombre: 'Test UM', abreviatura: 'TU' });
  const prod1 = await Producto.create({ codigo: 'P-001', nombre: 'Producto 1', categoria_id: cat.id, unidad_medida_id: um.id });
  const prod2 = await Producto.create({ codigo: 'P-002', nombre: 'Producto 2', categoria_id: cat.id, unidad_medida_id: um.id });
  
  await Venta.create({ producto_id: prod1.id, cantidad: 10, precio_unitario: 100, fecha_venta: new Date(), origen: 'manual', usuario_id: testUser.id });
  await Venta.create({ producto_id: prod2.id, cantidad: 20, precio_unitario: 150, fecha_venta: new Date(), origen: 'manual', usuario_id: testUser.id });
  
  const { req, res } = mockReqRes({}, {}, { producto: prod1.id }, userMock());
  await resumen(req, res, () => {});
  
  const body = res.getBody();
  assert.equal(res.getStatus(), 200);
  assert.equal(body.data.total_cantidad, 10);
  assert.equal(body.data.total_monto, 10 * 100);
});

test('HU10: resumen - filtro por rango de fechas', async () => {
  const cat = await Categoria.create({ nombre: 'Cat Test', descripcion: 'Test', vida_util_dias: 365 });
  const um = await UnidadMedida.create({ nombre: 'Test UM', abreviatura: 'TU' });
  const prod = await Producto.create({ codigo: 'P-001', nombre: 'Producto', categoria_id: cat.id, unidad_medida_id: um.id });
  
  const ayer = new Date(Date.now() - 86400000);
  const hoy = new Date();
  const manana = new Date(Date.now() + 86400000);
  
  await Venta.create({ producto_id: prod.id, cantidad: 10, precio_unitario: 100, fecha_venta: ayer, origen: 'manual', usuario_id: testUser.id });
  await Venta.create({ producto_id: prod.id, cantidad: 20, precio_unitario: 150, fecha_venta: hoy, origen: 'manual', usuario_id: testUser.id });
  await Venta.create({ producto_id: prod.id, cantidad: 30, precio_unitario: 200, fecha_venta: manana, origen: 'manual', usuario_id: testUser.id });
  
  const { req, res } = mockReqRes({}, {}, { 
    fecha_desde: hoy.toISOString().split('T')[0],
    fecha_hasta: hoy.toISOString().split('T')[0],
  }, userMock());
  await resumen(req, res, () => {});
  
  const body = res.getBody();
  assert.equal(res.getStatus(), 200);
  assert.equal(body.data.total_cantidad, 20);
  assert.equal(body.data.total_monto, 20 * 150);
});

test('HU10: resumen - sin ventas devuelve totales 0', async () => {
  const { req, res } = mockReqRes({}, {}, {}, userMock());
  await resumen(req, res, () => {});
  
  const body = res.getBody();
  assert.equal(res.getStatus(), 200);
  assert.equal(body.data.total_cantidad, 0);
  assert.equal(body.data.total_monto, 0);
  assert.deepEqual(body.data.origenes_incluidos, ['manual', 'importado']);
});