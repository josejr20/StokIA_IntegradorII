const test = require('node:test');
const assert = require('node:assert/strict');

const {
  prepararRegistros,
  validarReferencias,
  codigosConsecutivos,
  MAXIMO_FILAS_IMPORTACION,
} = require('../src/controllers/productoController');
const { ProductoDto } = require('../src/dtos/productoDto');

const FILA_VALIDA = {
  fila: 2,
  nombre: 'AJI-NO-MEN CARNE',
  categoria_id: 3,
  unidad_medida_id: 4,
  marca_id: 7,
  categoria_paquete_id: 2,
  contenido_valor: 80,
  contenido_paquete_cantidad: 24,
  contenido_paquete_envase_id: 5,
  precio_venta: '12.50',
  descripcion: 'Sazon de aji molido',
};

const CATALOGOS = {
  categorias: new Set([3, 9]),
  unidades: new Set([4]),
  marcas: new Set([7]),
  tiposEnvase: new Set([2, 5]),
};

function mensajes(registros, errores) {
  return errores.map((error) => error.msg);
}

test('prepararRegistros acepta una fila completa sin errores', () => {
  const { registros, errores } = prepararRegistros([FILA_VALIDA]);

  assert.equal(errores.length, 0);
  assert.equal(registros.length, 1);
  assert.equal(registros[0].nombre, 'AJI-NO-MEN CARNE');
  assert.equal(registros[0].categoria_id, 3);
  assert.equal(registros[0].contenido_paquete_cantidad, 24);
  assert.equal(registros[0].precio_venta, '12.50');
});

test('prepararRegistros reporta el numero de fila que envio el frontend', () => {
  const { errores } = prepararRegistros([{ ...FILA_VALIDA, fila: 7, nombre: '' }]);

  assert.equal(errores.length, 1);
  assert.equal(errores[0].fila, 7);
});

test('prepararRegistros numera las filas si el frontend no manda el numero', () => {
  const { errores } = prepararRegistros([{ ...FILA_VALIDA, fila: undefined, nombre: '' }]);

  assert.equal(errores[0].fila, 2);
});

test('prepararRegistros exige nombre, categoria, unidad y categoria de paquete', () => {
  const { errores } = prepararRegistros([{ fila: 2, nombre: '   ' }]);
  const found = mensajes([], errores);

  assert.ok(found.includes('Falta el nombre comercial'));
  assert.ok(found.includes('La categoría del producto es obligatoria'));
  assert.ok(found.includes('La unidad de medida del producto es obligatoria'));
  assert.ok(found.includes('La categoría de paquete del producto es obligatoria'));
});

test('prepararRegistros rechaza un nombre comercial de mas de 200 caracteres', () => {
  const { errores } = prepararRegistros([{ ...FILA_VALIDA, nombre: 'A'.repeat(201) }]);

  assert.ok(mensajes([], errores).includes('El nombre comercial supera los 200 caracteres'));
});

test('prepararRegistros convierte los campos opcionales vacios en null', () => {
  const { registros, errores } = prepararRegistros([{
    fila: 2,
    nombre: 'ARROZ',
    categoria_id: 3,
    unidad_medida_id: 4,
    categoria_paquete_id: 2,
  }]);

  assert.equal(errores.length, 0);
  assert.equal(registros[0].marca_id, null);
  assert.equal(registros[0].contenido_valor, null);
  assert.equal(registros[0].contenido_paquete_cantidad, null);
  assert.equal(registros[0].contenido_paquete_envase_id, null);
  assert.equal(registros[0].precio_venta, null);
  assert.equal(registros[0].descripcion, null);
});

test('prepararRegistros exige que la cantidad del empaque venga con su envase', () => {
  const soloCantidad = prepararRegistros([
    { ...FILA_VALIDA, contenido_paquete_envase_id: null },
  ]);
  const soloEnvase = prepararRegistros([
    { ...FILA_VALIDA, contenido_paquete_cantidad: null },
  ]);
  const ninguno = prepararRegistros([
    { ...FILA_VALIDA, contenido_paquete_cantidad: null, contenido_paquete_envase_id: null },
  ]);

  assert.ok(mensajes([], soloCantidad.errores)
    .includes('La cantidad del empaque y su envase deben venir juntos o ambos vacíos'));
  assert.ok(mensajes([], soloEnvase.errores)
    .includes('La cantidad del empaque y su envase deben venir juntos o ambos vacíos'));
  assert.equal(ninguno.errores.length, 0);
});

test('prepararRegistros exige que la cantidad del empaque sea mayor que cero', () => {
  const { errores } = prepararRegistros([{ ...FILA_VALIDA, contenido_paquete_cantidad: 0 }]);

  assert.ok(mensajes([], errores).includes('La cantidad del empaque debe ser mayor que cero'));
});

test('prepararRegistros rechaza precios y contenidos negativos o no numericos', () => {
  const negativo = prepararRegistros([{ ...FILA_VALIDA, precio_venta: '-5' }]);
  const noNumerico = prepararRegistros([{ ...FILA_VALIDA, contenido_valor: 'ochenta' }]);

  assert.ok(mensajes([], negativo.errores).includes('El precio de venta no puede ser negativo'));
  assert.ok(mensajes([], noNumerico.errores).includes('contenido_valor no es un número válido'));
});

test('prepararRegistros normaliza el precio a dos decimales', () => {
  const { registros } = prepararRegistros([{ ...FILA_VALIDA, precio_venta: 8 }]);

  assert.equal(registros[0].precio_venta, '8.00');
});

test('prepararRegistros conserva una fila valida aunque otra falle', () => {
  const { registros, errores } = prepararRegistros([
    FILA_VALIDA,
    { ...FILA_VALIDA, fila: 3, nombre: '' },
  ]);

  assert.equal(registros.length, 2);
  assert.equal(errores.length, 1);
  assert.equal(errores[0].fila, 3);
});

test('validarReferencias acepta ids que existen en el catalogo', () => {
  const { registros } = prepararRegistros([FILA_VALIDA]);

  assert.deepEqual(validarReferencias(registros, CATALOGOS), []);
});

test('validarReferencias rechaza una categoria que no existe', () => {
  const { registros } = prepararRegistros([{ ...FILA_VALIDA, categoria_id: 999 }]);
  const errores = validarReferencias(registros, CATALOGOS);

  assert.equal(errores.length, 1);
  assert.equal(errores[0].fila, 2);
  assert.equal(errores[0].msg, 'La categoría indicada no existe en el catálogo');
});

test('validarReferencias rechaza una marca y un envase del contenido inexistentes', () => {
  const { registros } = prepararRegistros([
    { ...FILA_VALIDA, marca_id: 999, contenido_paquete_envase_id: 888 },
  ]);
  const encontrados = mensajes(registros, validarReferencias(registros, CATALOGOS));

  assert.ok(encontrados.includes('La marca indicada no existe en el catálogo'));
  assert.ok(encontrados.includes('El envase del contenido indicado no existe en el catálogo'));
});

test('validarReferencias no repite el error de un id que ya falta en la fila', () => {
  // Si la fila vino sin categoria_id, prepararRegistros ya lo reporto y
  // validarReferencias no debe sumar un segundo error por lo mismo.
  const { registros, errores } = prepararRegistros([{ fila: 2, nombre: 'ARROZ' }]);

  assert.equal(errores.length, 3);
  assert.equal(validarReferencias(registros, CATALOGOS).length, 0);
});

test('codigosConsecutivos numera de corrido y rellena con ceros', () => {
  assert.deepEqual(codigosConsecutivos(1, 3), ['P-001', 'P-002', 'P-003']);
  assert.deepEqual(codigosConsecutivos(98, 3), ['P-098', 'P-099', 'P-100']);
  assert.deepEqual(codigosConsecutivos(999, 2), ['P-999', 'P-1000']);
});

test('cada registro de la importacion produce un ProductoDto con su codigo', () => {
  const filas = [FILA_VALIDA, { ...FILA_VALIDA, fila: 3, nombre: 'ARROZ' }];
  const { registros, errores } = prepararRegistros(filas);
  const referencias = validarReferencias(registros, CATALOGOS);

  assert.equal(errores.length + referencias.length, 0);

  const codigos = codigosConsecutivos(42, registros.length);
  const dtos = registros.map((registro, indice) => ProductoDto.fromCreate({ ...registro, codigo: codigos[indice] }));

  assert.deepEqual(dtos.map((dto) => dto.codigo), ['P-042', 'P-043']);
  assert.deepEqual(dtos.map((dto) => dto.nombre), ['AJI-NO-MEN CARNE', 'ARROZ']);
  assert.equal(dtos[0].activo, true);
  assert.equal(dtos[0].imagen, null);
  assert.deepEqual(dtos[0].caracteristicas, {});
  assert.equal(dtos[0].contenido_paquete_cantidad, 24);
  assert.equal(dtos[0].contenido_paquete_envase_id, 5);
});

test('la importacion admite hasta 500 productos por peticion', () => {
  assert.equal(MAXIMO_FILAS_IMPORTACION, 500);
});
