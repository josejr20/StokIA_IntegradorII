const test = require('node:test');
const assert = require('node:assert/strict');
const XLSX = require('xlsx');

const models = require('../src/models');
const { importar, parsearFechaVenta, MAXIMO_FILAS_IMPORTACION } = require('../src/controllers/ventaController');

function prepararMocks(t, { productos = [], yaImportado = false, failBulkCreate = false } = {}) {
  const original = {
    findOne: models.ImportacionVenta.findOne,
    create: models.ImportacionVenta.create,
    findAll: models.Producto.findAll,
    bulkCreate: models.Venta.bulkCreate,
    transaction: models.sequelize.transaction,
  };
  const guardado = { importaciones: [], ventas: [] };

  models.ImportacionVenta.findOne = async () => (yaImportado ? { id: 9 } : null);
  models.ImportacionVenta.create = async (datos) => {
    const importacion = {
      id: 12,
      ...datos,
      update: async (cambios) => {
        Object.assign(importacion, cambios);
        guardado.importaciones.push({ ...cambios });
        return importacion;
      },
    };
    guardado.importaciones.push({ ...datos });
    return importacion;
  };
  models.Producto.findAll = async () => productos;
  models.Venta.bulkCreate = async (ventas) => {
    if (failBulkCreate) throw new Error('error simulado de base de datos');
    guardado.ventas.push(...ventas);
  };
  models.sequelize.transaction = async () => ({
    commit: async () => {},
    rollback: async () => {},
  });

  t.after(() => {
    models.ImportacionVenta.findOne = original.findOne;
    models.ImportacionVenta.create = original.create;
    models.Producto.findAll = original.findAll;
    models.Venta.bulkCreate = original.bulkCreate;
    models.sequelize.transaction = original.transaction;
  });
  return guardado;
}

async function ejecutarImportacion(t, contenido, opciones = {}) {
  const { esperaError, ...mockOptions } = opciones;
  const guardado = prepararMocks(t, mockOptions);
  const req = {
    file: { buffer: Buffer.isBuffer(contenido) ? contenido : Buffer.from(contenido), originalname: 'ventas.csv' },
    user: { id: 4 },
  };
  const res = {
    statusCode: 200,
    status(codigo) { this.statusCode = codigo; return this; },
    json(cuerpo) { this.body = cuerpo; return this; },
  };
  let siguienteError;
  await importar(req, res, (error) => { siguienteError = error; });
  if (!esperaError) assert.equal(siguienteError, undefined);
  return { res, guardado, siguienteError };
}

const ENCABEZADOS = 'codigo_producto,cantidad,precio_unitario,fecha_venta,observacion\n';

test('importa filas válidas desde CSV con comas entre comillas y conserva el stock fuera del flujo', async (t) => {
  const { res, guardado } = await ejecutarImportacion(
    t,
    `${ENCABEZADOS}P-001,2,4.50,2024-04-01,"venta, histórica"\n`,
    { productos: [{ id: 7, codigo: 'P-001', activo: true }] },
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    importacion_id: 12,
    total: 1,
    procesadas: 1,
    rechazadas: 0,
    errores: [],
  });
  assert.equal(guardado.ventas.length, 1);
  assert.equal(guardado.ventas[0].producto_id, 7);
  assert.equal(guardado.ventas[0].origen, 'importado');
  assert.equal(guardado.ventas[0].usuario_id, 4);
  assert.equal(guardado.importaciones.at(-1).estado, 'completado');
});

test('importa solo filas válidas y informa producto inexistente, inactivo y valores inválidos', async (t) => {
  const contenido = [
    ENCABEZADOS.trimEnd(),
    'P-001,1,2,2024-01-01,',
    'P-404,1,2,2024-01-01,',
    'P-002,1,2,2024-01-01,',
    'P-001,0,-1,2024-01-01,',
  ].join('\n');
  const { res, guardado } = await ejecutarImportacion(t, contenido, {
    productos: [
      { id: 1, codigo: 'P-001', activo: true },
      { id: 2, codigo: 'P-002', activo: false },
    ],
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.procesadas, 1);
  assert.equal(res.body.rechazadas, 3);
  assert.match(res.body.errores[0].motivo, /Producto no encontrado/);
  assert.match(res.body.errores[1].motivo, /Producto inactivo/);
  assert.match(res.body.errores[2].motivo, /cantidad debe ser mayor a 0/);
  assert.equal(guardado.importaciones.at(-1).filas_con_error, 3);
});

test('marca la importación como fallida cuando ninguna fila se procesa', async (t) => {
  const { res, guardado } = await ejecutarImportacion(
    t,
    `${ENCABEZADOS}P-404,1,2,2024-01-01,\n`,
    { productos: [] },
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.procesadas, 0);
  assert.equal(res.body.rechazadas, 1);
  assert.equal(guardado.importaciones.at(-1).estado, 'fallido');
});

test('revierte la inserción y deja trazabilidad fallida si bulkCreate lanza un error', async (t) => {
  const { res, guardado, siguienteError } = await ejecutarImportacion(
    t,
    `${ENCABEZADOS}P-001,1,2,2024-01-01,\n`,
    { productos: [{ id: 1, codigo: 'P-001', activo: true }], failBulkCreate: true, esperaError: true },
  );

  assert.ok(siguienteError);
  assert.equal(guardado.ventas.length, 0);
  assert.equal(guardado.importaciones.at(-1).estado, 'fallido');
  assert.equal(guardado.importaciones.at(-1).detalle_errores[0].motivo, 'No se pudo guardar la importación');
  assert.equal(res.body, undefined);
});

test('rechaza encabezados incompletos con las columnas faltantes', async (t) => {
  const { res, guardado } = await ejecutarImportacion(t, 'codigo_producto,cantidad\nP-001,1\n');

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body.columnas_faltantes, ['precio_unitario', 'fecha_venta']);
  assert.equal(guardado.importaciones.at(-1).estado, 'fallido');
});

test('rechaza archivos de más de 500 filas sin insertar ventas', async (t) => {
  const filas = Array.from({ length: 501 }, () => 'P-001,1,1,2024-01-01');
  const { res, guardado } = await ejecutarImportacion(t, `${ENCABEZADOS}${filas.join('\n')}`, {
    productos: [{ id: 1, codigo: 'P-001', activo: true }],
  });

  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /500 filas/);
  assert.equal(guardado.ventas.length, 0);
  assert.equal(guardado.importaciones.at(-1).estado, 'fallido');
});

test('rechaza el reimporte del mismo archivo', async (t) => {
  const guardado = prepararMocks(t, { yaImportado: true });
  const req = {
    file: { buffer: Buffer.from(`${ENCABEZADOS}P-001,1,1,2024-01-01\n`), originalname: 'ventas.csv' },
    user: { id: 4 },
  };
  const res = {
    statusCode: 200,
    status(codigo) { this.statusCode = codigo; return this; },
    json(cuerpo) { this.body = cuerpo; return this; },
  };

  await importar(req, res, () => {});
  assert.equal(res.statusCode, 409);
  assert.equal(guardado.importaciones.length, 0);
});

test('importa un libro Excel usando el mismo parser que CSV', async (t) => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['codigo_producto', 'cantidad', 'precio_unitario', 'fecha_venta'],
    ['P-001', 3, 2.25, new Date('2024-02-15T00:00:00Z')],
  ]), 'Ventas');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  const { res, guardado } = await ejecutarImportacion(t, buffer, {
    productos: [{ id: 7, codigo: 'P-001', activo: true }],
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.procesadas, 1);
  assert.equal(guardado.ventas[0].fecha_venta.toISOString(), '2024-02-15T00:00:00.000Z');
});

test('el middleware requiere el permiso de importación', async (t) => {
  const { Usuario } = models;
  const originalFindByPk = Usuario.findByPk;
  Usuario.findByPk = async () => ({
    is_staff: false,
    is_superuser: false,
    email: 'operador@ejemplo.test',
    rol: { getPermisos: async () => [{ codigo: 'gestionar_ventas' }] },
  });
  t.after(() => { Usuario.findByPk = originalFindByPk; });

  const verificarPermiso = require('../src/middleware/permission').verificarPermiso('importar_ventas');
  const res = {
    statusCode: 200,
    status(codigo) { this.statusCode = codigo; return this; },
    json(cuerpo) { this.body = cuerpo; return this; },
  };
  let pasoAlSiguiente = false;
  await verificarPermiso({ user: { id: 8 } }, res, () => { pasoAlSiguiente = true; });

  assert.equal(res.statusCode, 403);
  assert.equal(pasoAlSiguiente, false);
});

test('valida fechas de Excel y limita el archivo a 500 filas', () => {
  assert.equal(parsearFechaVenta('31/02/2024'), null);
  assert.equal(parsearFechaVenta('2024-02-30'), null);
  assert.equal(parsearFechaVenta('15/02/2024').toISOString(), '2024-02-15T00:00:00.000Z');
  assert.equal(parsearFechaVenta(new Date('2024-02-15T00:00:00Z')).toISOString(), '2024-02-15T00:00:00.000Z');
  assert.equal(MAXIMO_FILAS_IMPORTACION, 500);

  const workbook = XLSX.read(Buffer.from(`${ENCABEZADOS}P-001,1,1,2024-01-01`), { type: 'buffer', cellDates: true });
  assert.equal(workbook.SheetNames.length, 1);
});
