const test = require('node:test');
const assert = require('node:assert/strict');

const { ProductoDto } = require('../src/dtos/productoDto');

test('ProductoDto.fromCreate construye un producto con valores por defecto', () => {
  const producto = ProductoDto.fromCreate({
    codigo: 'P-001',
    nombre: 'Cafe',
    categoria_id: 3,
    unidad_medida_id: 2,
  });

  assert.deepEqual(producto, {
    codigo: 'P-001',
    nombre: 'Cafe',
    categoria_id: 3,
    unidad_medida_id: 2,
    presentacion_id: null,
    marca_id: null,
    categoria_paquete_id: null,
    contenido_valor: null,
    contenido_paquete_cantidad: null,
    contenido_paquete_envase_id: null,
    precio_venta: null,
    caracteristicas: {},
    imagen: null,
    descripcion: null,
    activo: true,
  });
});

test('ProductoDto.fromUpdate solo incluye campos enviados', () => {
  assert.deepEqual(
    ProductoDto.fromUpdate({ nombre: 'Cafe premium', precio_venta: '18.50' }),
    { nombre: 'Cafe premium', precio_venta: '18.50' },
  );
});

test('ProductoDto.fromModel expone nombres de relaciones y stock inicial', () => {
  const producto = ProductoDto.fromModel({
    id: 4,
    codigo: 'P-004',
    nombre: 'Arroz',
    categoria_id: 1,
    unidad_medida_id: 2,
    marca_id: 3,
    categoria: { nombre: 'Granos', vida_util_dias: 365 },
    unidadMedida: { nombre: 'Kilogramo', simbolo: 'kg' },
    marca: { nombre: 'Marca Demo' },
    activo: true,
  });

  assert.equal(producto.categoria_nombre, 'Granos');
  assert.equal(producto.unidad_medida_simbolo, 'kg');
  assert.equal(producto.marca_nombre, 'Marca Demo');
  assert.equal(producto.stock_total, 0);
});