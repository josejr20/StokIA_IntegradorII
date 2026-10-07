const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');

const {
  listar,
  obtener,
  crear,
  actualizar,
  importar,
  desactivar,
  activar,
  ingreso,
  prepararRegistros,
  validarReferencias,
  codigosConsecutivos,
  MAXIMO_FILAS_IMPORTACION,
} = require('../src/controllers/productoController');

const { Producto, Categoria, UnidadMedida, CatalogoMarca, tipoEnvase, ProductoPresentacion, Lote } = require('../src/models');
const { ProductoDto } = require('../src/dtos/productoDto');

function mockReqRes(body = {}, params = {}, query = {}, file = null) {
  let resBody;
  let resStatus = 200;
  return {
    req: { body, params, query, file },
    res: {
      status(s) { resStatus = s; return this; },
      json(b) { resBody = b; return this; },
      getBody() { return resBody; },
      getStatus() { return resStatus; },
    },
    next: (err) => { throw err; },
  };
}

test.beforeEach(async () => {
  await Lote.destroy({ where: {}, force: true });
  await ProductoPresentacion.destroy({ where: {}, force: true });
  await Producto.destroy({ where: {}, force: true });
  await Categoria.destroy({ where: {}, force: true });
  await UnidadMedida.destroy({ where: {}, force: true });
  await CatalogoMarca.destroy({ where: {}, force: true });
  await tipoEnvase.destroy({ where: {}, force: true });
});

test('HU3: actualizar - editar nombre actualiza fecha_actualizacion', async () => {
  const cat = await Categoria.create({ nombre: 'Cat Test', descripcion: 'Test', vida_util_dias: 365 });
  const um = await UnidadMedida.create({ nombre: 'Test UM', abreviatura: 'TU' });
  const prod = await Producto.create({ codigo: 'P-001', nombre: 'Original', categoria_id: cat.id, unidad_medida_id: um.id });
  
  const originalFecha = prod.fecha_actualizacion;
  
  await new Promise(r => setTimeout(r, 10));
  
  const { req, res } = mockReqRes({ nombre: 'Actualizado' }, { id: prod.id });
  await actualizar(req, res, () => {});
  
  const updated = await Producto.findByPk(prod.id);
  assert.ok(updated.fecha_actualizacion > originalFecha, 'fecha_actualizacion debe ser mayor que la original');
  assert.equal(updated.nombre, 'Actualizado');
});

test('HU3: actualizar - editar precio_venta actualiza fecha_actualizacion', async () => {
  const cat = await Categoria.create({ nombre: 'Cat Test', descripcion: 'Test', vida_util_dias: 365 });
  const um = await UnidadMedida.create({ nombre: 'Test UM', abreviatura: 'TU' });
  const prod = await Producto.create({ codigo: 'P-001', nombre: 'Original', categoria_id: cat.id, unidad_medida_id: um.id, precio_venta: '10.00' });
  
  const originalFecha = prod.fecha_actualizacion;
  
  await new Promise(r => setTimeout(r, 10));
  
  const { req, res } = mockReqRes({ precio_venta: '15.00' }, { id: prod.id });
  await actualizar(req, res, () => {});
  
  const updated = await Producto.findByPk(prod.id);
  assert.ok(updated.fecha_actualizacion > originalFecha, 'fecha_actualizacion debe ser mayor que la original');
  assert.equal(Number(updated.precio_venta), 15.00);
});

test('HU3: actualizar - campos opcionales no requeridos (categoria_id, unidad_medida_id no obligatorios en update)', async () => {
  const cat = await Categoria.create({ nombre: 'Cat Test', descripcion: 'Test', vida_util_dias: 365 });
  const um = await UnidadMedida.create({ nombre: 'Test UM', abreviatura: 'TU' });
  const prod = await Producto.create({ codigo: 'P-001', nombre: 'Original', categoria_id: cat.id, unidad_medida_id: um.id });
  
  const { req, res } = mockReqRes({ descripcion: 'Nueva descripcion' }, { id: prod.id });
  await actualizar(req, res, () => {});
  
  const updated = await Producto.findByPk(prod.id);
  assert.equal(updated.descripcion, 'Nueva descripcion');
  assert.equal(updated.categoria_id, cat.id);
  assert.equal(updated.unidad_medida_id, um.id);
});

test('HU4: listar - ordenado por nombre ASC', async () => {
  const cat = await Categoria.create({ nombre: 'Cat Test', descripcion: 'Test', vida_util_dias: 365 });
  const um = await UnidadMedida.create({ nombre: 'Test UM', abreviatura: 'TU' });
  await Producto.create({ codigo: 'P-001', nombre: 'Zebra', categoria_id: cat.id, unidad_medida_id: um.id });
  await Producto.create({ codigo: 'P-002', nombre: 'Alpha', categoria_id: cat.id, unidad_medida_id: um.id });
  await Producto.create({ codigo: 'P-003', nombre: 'Beta', categoria_id: cat.id, unidad_medida_id: um.id });
  
  const { req, res } = mockReqRes({}, {}, {});
  await listar(req, res, () => {});
  
  const data = res.getBody().data;
  assert.equal(data[0].nombre, 'Alpha');
  assert.equal(data[1].nombre, 'Beta');
  assert.equal(data[2].nombre, 'Zebra');
});

test('HU4: listar - paginación con page y page_size', async () => {
  const cat = await Categoria.create({ nombre: 'Cat Test', descripcion: 'Test', vida_util_dias: 365 });
  const um = await UnidadMedida.create({ nombre: 'Test UM', abreviatura: 'TU' });
  for (let i = 1; i <= 5; i++) {
    await Producto.create({ codigo: `P-${String(i).padStart(3, '0')}`, nombre: `Producto ${i}`, categoria_id: cat.id, unidad_medida_id: um.id });
  }
  
  const { req, res } = mockReqRes({}, {}, { page: '1', page_size: '2' });
  await listar(req, res, () => {});
  
  const body = res.getBody();
  assert.equal(body.data.length, 2);
  assert.equal(body.count, 5);
  assert.equal(body.next, true);
  assert.equal(body.previous, false);
  assert.equal(body.data[0].nombre, 'Producto 1');
  assert.equal(body.data[1].nombre, 'Producto 2');
  
  const { req: req2, res: res2 } = mockReqRes({}, {}, { page: '2', page_size: '2' });
  await listar(req2, res2, () => {});
  
  const body2 = res2.getBody();
  assert.equal(body2.data.length, 2);
  assert.equal(body2.count, 5);
  assert.equal(body2.next, true);
  assert.equal(body2.previous, true);
  assert.equal(body2.data[0].nombre, 'Producto 3');
  assert.equal(body2.data[1].nombre, 'Producto 4');
  
  const { req: req3, res: res3 } = mockReqRes({}, {}, { page: '3', page_size: '2' });
  await listar(req3, res3, () => {});
  
  const body3 = res3.getBody();
  assert.equal(body3.data.length, 1);
  assert.equal(body3.count, 5);
  assert.equal(body3.next, false);
  assert.equal(body3.previous, true);
  assert.equal(body3.data[0].nombre, 'Producto 5');
});

test('HU4: listar - stock_total viene de subquery', async () => {
  const cat = await Categoria.create({ nombre: 'Cat Test', descripcion: 'Test', vida_util_dias: 365 });
  const um = await UnidadMedida.create({ nombre: 'Test UM', abreviatura: 'TU' });
  const prod = await Producto.create({ codigo: 'P-001', nombre: 'Test Stock', categoria_id: cat.id, unidad_medida_id: um.id });
  
  await Lote.create({ producto_id: prod.id, numero_lote: 'LT-001', cantidad_inicial: 10, cantidad_actual: 10, fecha_ingreso: new Date(), fecha_vencimiento: null });
  await Lote.create({ producto_id: prod.id, numero_lote: 'LT-002', cantidad_inicial: 5, cantidad_actual: 5, fecha_ingreso: new Date(), fecha_vencimiento: null });
  
  const { req, res } = mockReqRes({}, {}, {});
  await listar(req, res, () => {});
  
  const data = res.getBody().data;
  const prodData = data.find(p => p.id === prod.id);
  assert.equal(prodData.stock_total, 15);
});

test('HU4: listar - sin paginación si no viene page', async () => {
  const cat = await Categoria.create({ nombre: 'Cat Test', descripcion: 'Test', vida_util_dias: 365 });
  const um = await UnidadMedida.create({ nombre: 'Test UM', abreviatura: 'TU' });
  for (let i = 1; i <= 15; i++) {
    await Producto.create({ codigo: `P-${String(i).padStart(3, '0')}`, nombre: `Producto ${i}`, categoria_id: cat.id, unidad_medida_id: um.id });
  }
  
  const { req, res } = mockReqRes({}, {}, {});
  await listar(req, res, () => {});
  
  const data = res.getBody().data;
  assert.equal(data.length, 15);
  assert.ok(res.getBody().count === undefined);
});

test('HU4: listar - filtro por search', async () => {
  const cat = await Categoria.create({ nombre: 'Cat Test', descripcion: 'Test', vida_util_dias: 365 });
  const um = await UnidadMedida.create({ nombre: 'Test UM', abreviatura: 'TU' });
  await Producto.create({ codigo: 'P-001', nombre: 'Cafe Premium', categoria_id: cat.id, unidad_medida_id: um.id });
  await Producto.create({ codigo: 'P-002', nombre: 'Te Verde', categoria_id: cat.id, unidad_medida_id: um.id });
  await Producto.create({ codigo: 'P-003', nombre: 'Agua Mineral', categoria_id: cat.id, unidad_medida_id: um.id });
  
  const { req, res } = mockReqRes({}, {}, { search: 'cafe' });
  await listar(req, res, () => {});
  
  const data = res.getBody().data;
  assert.equal(data.length, 1);
  assert.equal(data[0].nombre, 'Cafe Premium');
});

test('HU5: desactivar - con stock sin confirmar_stock → 409', async () => {
  const cat = await Categoria.create({ nombre: 'Cat Test', descripcion: 'Test', vida_util_dias: 365 });
  const um = await UnidadMedida.create({ nombre: 'Test UM', abreviatura: 'TU' });
  const prod = await Producto.create({ codigo: 'P-001', nombre: 'Con Stock', categoria_id: cat.id, unidad_medida_id: um.id });
  await Lote.create({ producto_id: prod.id, numero_lote: 'LT-001', cantidad_inicial: 10, cantidad_actual: 10, fecha_ingreso: new Date() });
  
  const { req, res } = mockReqRes({ motivo_desactivacion: 'agotado' }, { id: prod.id });
  await desactivar(req, res, () => {});
  
  assert.equal(res.getStatus(), 409);
  assert.equal(res.getBody().code, 'STOCK_PENDIENTE');
  assert.equal(res.getBody().stock_total, 10);
  assert.ok(res.getBody().error.includes('10 unidades en stock'));
});

test('HU5: desactivar - con stock y confirmar_stock: true → 200', async () => {
  const cat = await Categoria.create({ nombre: 'Cat Test', descripcion: 'Test', vida_util_dias: 365 });
  const um = await UnidadMedida.create({ nombre: 'Test UM', abreviatura: 'TU' });
  const prod = await Producto.create({ codigo: 'P-001', nombre: 'Con Stock', categoria_id: cat.id, unidad_medida_id: um.id });
  await Lote.create({ producto_id: prod.id, numero_lote: 'LT-001', cantidad_inicial: 10, cantidad_actual: 10, fecha_ingreso: new Date() });
  
  const { req, res } = mockReqRes({ motivo_desactivacion: 'agotado', confirmar_stock: true }, { id: prod.id });
  await desactivar(req, res, () => {});
  
  assert.equal(res.getStatus(), 200);
  const updated = await Producto.findByPk(prod.id);
  assert.equal(updated.activo, false);
  assert.equal(updated.motivo_desactivacion, 'agotado');
});

test('HU5: desactivar - sin stock → 200 directo', async () => {
  const cat = await Categoria.create({ nombre: 'Cat Test', descripcion: 'Test', vida_util_dias: 365 });
  const um = await UnidadMedida.create({ nombre: 'Test UM', abreviatura: 'TU' });
  const prod = await Producto.create({ codigo: 'P-001', nombre: 'Sin Stock', categoria_id: cat.id, unidad_medida_id: um.id });
  
  const { req, res } = mockReqRes({ motivo_desactivacion: 'caducado' }, { id: prod.id });
  await desactivar(req, res, () => {});
  
  assert.equal(res.getStatus(), 200);
  const updated = await Producto.findByPk(prod.id);
  assert.equal(updated.activo, false);
  assert.equal(updated.motivo_desactivacion, 'caducado');
});

test('HU5: desactivar - motivo inválido → 400', async () => {
  const cat = await Categoria.create({ nombre: 'Cat Test', descripcion: 'Test', vida_util_dias: 365 });
  const um = await UnidadMedida.create({ nombre: 'Test UM', abreviatura: 'TU' });
  const prod = await Producto.create({ codigo: 'P-001', nombre: 'Test', categoria_id: cat.id, unidad_medida_id: um.id });
  
  const { req, res } = mockReqRes({ motivo_desactivacion: 'invalido' }, { id: prod.id });
  await desactivar(req, res, () => {});
  
  assert.equal(res.getStatus(), 400);
  assert.ok(res.getBody().error.includes('inválido'));
});

test('HU5: desactivar - motivo "otro" sin detalle → 400', async () => {
  const cat = await Categoria.create({ nombre: 'Cat Test', descripcion: 'Test', vida_util_dias: 365 });
  const um = await UnidadMedida.create({ nombre: 'Test UM', abreviatura: 'TU' });
  const prod = await Producto.create({ codigo: 'P-001', nombre: 'Test', categoria_id: cat.id, unidad_medida_id: um.id });
  
  const { req, res } = mockReqRes({ motivo_desactivacion: 'otro' }, { id: prod.id });
  await desactivar(req, res, () => {});
  
  assert.equal(res.getStatus(), 400);
  assert.ok(res.getBody().error.includes('detalle'));
});

test('HU5: desactivar - motivo "otro" con detalle → 200', async () => {
  const cat = await Categoria.create({ nombre: 'Cat Test', descripcion: 'Test', vida_util_dias: 365 });
  const um = await UnidadMedida.create({ nombre: 'Test UM', abreviatura: 'TU' });
  const prod = await Producto.create({ codigo: 'P-001', nombre: 'Test', categoria_id: cat.id, unidad_medida_id: um.id });
  
  const { req, res } = mockReqRes({ motivo_desactivacion: 'otro', motivo_desactivacion_detalle: 'Cambio de proveedor' }, { id: prod.id });
  await desactivar(req, res, () => {});
  
  assert.equal(res.getStatus(), 200);
  const updated = await Producto.findByPk(prod.id);
  assert.equal(updated.activo, false);
  assert.equal(updated.motivo_desactivacion, 'otro');
  assert.equal(updated.motivo_desactivacion_detalle, 'Cambio de proveedor');
});