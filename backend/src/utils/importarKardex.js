'use strict';

function normalizarPresentacion(valor) {
  return String(valor ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toLocaleUpperCase('es-PE');
}

function agregarCandidato(indice, clave, productoId) {
  const normalizada = normalizarPresentacion(clave);
  if (!normalizada) return;

  const candidatos = indice.get(normalizada) || new Set();
  candidatos.add(Number(productoId));
  indice.set(normalizada, candidatos);
}

function crearIndiceProductos(productos, mapeosLegados = {}) {
  const porDescripcion = new Map();
  const porNombre = new Map();
  const productosPorId = new Set(productos.map((producto) => Number(producto.id)));

  for (const producto of productos) {
    agregarCandidato(porDescripcion, producto.descripcion, producto.id);
    agregarCandidato(porNombre, producto.nombre, producto.id);
  }

  const legados = new Map();
  for (const [presentacion, productoId] of Object.entries(mapeosLegados)) {
    const id = Number(productoId);
    if (productosPorId.has(id)) {
      legados.set(normalizarPresentacion(presentacion), id);
    }
  }

  return { porDescripcion, porNombre, legados };
}

function obtenerProductoId(presentacion, indice) {
  const clave = normalizarPresentacion(presentacion);
  const descripcion = indice.porDescripcion.get(clave);
  if (descripcion?.size === 1) return { productoId: [...descripcion][0] };
  if (descripcion?.size > 1) return { ambiguo: true };

  const legado = indice.legados.get(clave);
  if (legado !== undefined) return { productoId: legado };

  const nombre = indice.porNombre.get(clave);
  if (nombre?.size === 1) return { productoId: [...nombre][0] };
  if (nombre?.size > 1) return { ambiguo: true };

  return { productoId: null };
}

function clasificarMotivo(motivo) {
  const texto = String(motivo ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-PE');

  if (texto.includes('devolucion') && texto.includes('ingreso')) return 'devolucion';
  if (texto.includes('venta') && texto.includes('salida')) return 'venta';
  if (texto.includes('compra') && texto.includes('ingreso')) return 'compra';
  return null;
}

function prioridadMotivo(motivo) {
  const tipo = clasificarMotivo(motivo);
  if (tipo === 'compra') return 0;
  if (tipo === 'venta') return 1;
  if (tipo === 'devolucion') return 2;
  return 3;
}

function limitarMotivo(texto, maximo = 200) {
  return String(texto ?? '').trim().slice(0, maximo);
}

module.exports = {
  clasificarMotivo,
  crearIndiceProductos,
  limitarMotivo,
  normalizarPresentacion,
  obtenerProductoId,
  prioridadMotivo,
};
