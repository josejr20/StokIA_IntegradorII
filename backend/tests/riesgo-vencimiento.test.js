// HU-98 · QA-01 — Casos de prueba de "Detectar riesgo de vencimiento de productos" (TC-01 a TC-07).
// Usa datos simulados: no necesita base de datos.
const test = require('node:test');
const assert = require('node:assert/strict');

const riesgo = require('../src/services/riesgoVencimientoModelo');
const { analizarRiesgo } = require('../src/services/riesgoVencimientoService');
const { leerParametros, MAX_PRODUCTOS } = require('../src/controllers/riesgoVencimientoController');

const AHORA = new Date('2026-10-21T15:00:00-05:00'); // hoy en Lima: 2026-10-21
const HOY = '2026-10-21';

const sumarDias = (iso, dias) => new Date(Date.parse(`${iso}T00:00:00Z`) + dias * 86400000).toISOString().slice(0, 10);

// Demanda simulada con la forma que devuelve el modelo de HU-72.
function demanda({ porDia = 1, dias = 200, confianza = 'alta' } = {}) {
  return {
    estado: 'ok',
    promedio_diario: porDia,
    confianza,
    proyeccion: Array.from({ length: dias }, (_, i) => ({ fecha: sumarDias(HOY, i), cantidad: porDia })),
  };
}
const sinDemanda = { estado: 'datos_insuficientes', mensaje: 'No hay datos suficientes para predecir' };

const lote = (id, stock, diasParaVencer, extra = {}) => ({
  id,
  numero_lote: `LT-${id}`,
  cantidad_actual: String(stock),
  fecha_vencimiento: diasParaVencer === null ? null : sumarDias(HOY, diasParaVencer),
  ...extra,
});
const evaluarUno = (l, d) => riesgo.evaluarLotes([l], d, HOY)[0];

test('TC-01: stock alto, vencimiento próximo y demanda menor al stock => riesgo alto con sus factores', () => {
  const r = evaluarUno(lote(1, 100, 30), demanda({ porDia: 1 })); // se venderían 30 de 100
  assert.equal(r.estado, 'ok');
  assert.equal(r.nivel, 'alto');
  assert.equal(r.unidades_en_riesgo, 70);
  assert.equal(r.porcentaje_en_riesgo, 70);
  assert.ok(r.factores.length >= 4);
});

test('TC-02: la demanda estimada agota el stock antes de vencer => riesgo bajo', () => {
  const r = evaluarUno(lote(1, 100, 60), demanda({ porDia: 5 })); // se venderían 300 > 100
  assert.equal(r.nivel, 'bajo');
  assert.equal(r.unidades_en_riesgo, 0);
  assert.match(r.factores.join(' '), /alcanza para vender todo el lote/);
});

test('TC-03: el riesgo depende del stock, de la demanda estimada y de la fecha de vencimiento', () => {
  const base = evaluarUno(lote(1, 100, 30), demanda({ porDia: 2 })); // 60 se venden, 40 % en riesgo
  const masStock = evaluarUno(lote(1, 200, 30), demanda({ porDia: 2 }));
  const masDemanda = evaluarUno(lote(1, 100, 30), demanda({ porDia: 4 }));
  const masPlazo = evaluarUno(lote(1, 100, 60), demanda({ porDia: 2 }));
  assert.ok(masStock.porcentaje_en_riesgo > base.porcentaje_en_riesgo);
  assert.ok(masDemanda.porcentaje_en_riesgo < base.porcentaje_en_riesgo);
  assert.ok(masPlazo.porcentaje_en_riesgo < base.porcentaje_en_riesgo);
});

test('TC-04: clasifica en niveles alto, medio y bajo', () => {
  // Stock 100 y demanda hasta el vencimiento: 30 -> 70 % en riesgo, 80 -> 20 %, 96 -> 4 %.
  assert.equal(evaluarUno(lote(1, 100, 30), demanda({ porDia: 1 })).nivel, 'alto');
  assert.equal(evaluarUno(lote(1, 100, 40), demanda({ porDia: 2 })).nivel, 'medio');
  assert.equal(evaluarUno(lote(1, 100, 24), demanda({ porDia: 4 })).nivel, 'bajo');
  assert.equal(riesgo.clasificarNivel(0.5, 60), 'alto');
  assert.equal(riesgo.clasificarNivel(0.15, 60), 'medio');
  assert.equal(riesgo.clasificarNivel(0.149, 60), 'bajo');
});

test('TC-04: un riesgo medio con vencimiento en 7 días o menos sube a alto', () => {
  assert.equal(riesgo.clasificarNivel(0.3, 20), 'medio');
  assert.equal(riesgo.clasificarNivel(0.3, 7), 'alto');
  assert.equal(riesgo.clasificarNivel(0.05, 3), 'bajo'); // sin unidades en riesgo no hay urgencia
});

test('TC-05: muestra los factores que justifican la clasificación', () => {
  const r = evaluarUno(lote(1, 100, 30), demanda({ porDia: 1, confianza: 'media' }));
  const texto = r.factores.join(' | ');
  assert.match(texto, /Stock disponible: 100 unidades/);
  assert.match(texto, /Vence el 20\/11\/2026 \(en 30 días\)/);
  assert.match(texto, /Demanda estimada hasta el vencimiento: 30 unidades/);
  assert.match(texto, /70 unidades \(70 %\) no se alcanzarían a vender/);
  assert.match(texto, /Confianza de la estimación de demanda: media/);
  assert.match(r.mensaje, /^Riesgo alto/);
});

test('FEFO: el lote que vence antes se abastece primero y el otro cuenta solo con la demanda restante', () => {
  const [a, b] = riesgo.evaluarLotes([lote(2, 100, 40), lote(1, 50, 10)], demanda({ porDia: 3 }), HOY);
  // Lote 1 vence en 10 días: demanda 30 -> se venden 30 de 50 (20 en riesgo, 40 %)
  assert.equal(a.lote_id, 1);
  assert.equal(a.unidades_en_riesgo, 20);
  assert.equal(a.nivel, 'medio');
  // Lote 2 vence en 40 días: demanda 120, 30 ya van al lote 1 -> se venden 90 de 100 (10 en riesgo, 10 %)
  assert.equal(b.lote_id, 2);
  assert.equal(b.demanda_hasta_vencimiento, 120);
  assert.equal(b.unidades_en_riesgo, 10);
  assert.equal(b.nivel, 'bajo');
  assert.match(b.factores.join(' '), /30 se destinan antes a lotes que vencen primero/);
});

test('un lote que ya venció con stock es riesgo alto sin necesitar demanda estimada', () => {
  const r = evaluarUno(lote(1, 40, -5), null);
  assert.equal(r.nivel, 'alto');
  assert.equal(r.vencido, true);
  assert.equal(r.unidades_en_riesgo, 40);
  assert.match(r.mensaje, /ya venció/);
  assert.equal(evaluarUno(lote(2, 10, 0), null).nivel, 'alto'); // vence hoy
});

test('TC-07: informa que no hay datos suficientes (sin fecha de vencimiento o sin demanda estimada)', () => {
  const sinFecha = evaluarUno(lote(1, 100, null), demanda());
  assert.equal(sinFecha.estado, 'datos_insuficientes');
  assert.equal(sinFecha.motivo, 'sin_fecha_vencimiento');
  assert.equal(sinFecha.nivel, null);
  assert.match(sinFecha.mensaje, /no hay datos suficientes/i);

  const sinVentas = evaluarUno(lote(1, 100, 30), sinDemanda);
  assert.equal(sinVentas.estado, 'datos_insuficientes');
  assert.equal(sinVentas.motivo, 'sin_demanda_estimada');
  assert.match(sinVentas.mensaje, /historial de ventas/);
});

test('los lotes agotados (stock 0) no se analizan', () => {
  assert.equal(riesgo.evaluarLotes([lote(1, 0, 30)], demanda(), HOY).length, 0);
});

test('el producto toma el nivel de su peor lote', () => {
  const lotes = riesgo.evaluarLotes([lote(1, 10, 100), lote(2, 100, 5)], demanda({ porDia: 1 }), HOY);
  assert.equal(riesgo.consolidarProducto(lotes).nivel, 'alto');
  const soloSinDatos = riesgo.evaluarLotes([lote(3, 5, null)], demanda(), HOY);
  assert.equal(riesgo.consolidarProducto(soloSinDatos).nivel, 'datos_insuficientes');
});

// ---- Servicio (con repositorio y predictor simulados) ----

function entorno({ lotes, productos, demandas = {} }) {
  const llamadas = [];
  return {
    llamadas,
    repositorio: {
      lotes: async (ids) => lotes.filter((l) => l.cantidad_actual > 0 && (!ids || ids.includes(l.producto_id))),
      productos: async (ids) => productos.filter((p) => ids.includes(p.id)),
    },
    predictor: async (ids, opciones) => {
      llamadas.push({ ids, ...opciones });
      return { resultados: ids.map((id) => ({ producto_id: id, ...(demandas[id] ?? sinDemanda) })) };
    },
  };
}
const productosBase = [
  { id: 1, codigo: 'P-001', nombre: 'Producto A', activo: true },
  { id: 2, codigo: 'P-002', nombre: 'Producto B', activo: true },
  { id: 3, codigo: 'P-003', nombre: 'Producto C', activo: true },
];

test('servicio: resume por nivel, ordena lo más grave primero y estima demanda solo cuando hace falta', async () => {
  const e = entorno({
    productos: productosBase,
    lotes: [
      { id: 10, producto_id: 1, numero_lote: 'A1', cantidad_actual: 100, fecha_vencimiento: sumarDias(HOY, 60) }, // bajo
      { id: 20, producto_id: 2, numero_lote: 'B1', cantidad_actual: 100, fecha_vencimiento: sumarDias(HOY, 30) }, // alto
      { id: 30, producto_id: 3, numero_lote: 'C1', cantidad_actual: 50, fecha_vencimiento: null }, // sin datos
    ],
    demandas: { 1: demanda({ porDia: 5 }), 2: demanda({ porDia: 1 }) },
  });
  const r = await analizarRiesgo({ ahora: AHORA, repositorio: e.repositorio, predictor: e.predictor });

  assert.equal(r.fecha_analisis, HOY);
  assert.deepEqual(r.resumen, { productos_analizados: 3, lotes_analizados: 3, alto: 1, medio: 0, bajo: 1, datos_insuficientes: 1 });
  assert.deepEqual(r.productos.map((p) => p.nivel), ['alto', 'bajo', 'datos_insuficientes']);
  assert.equal(r.productos[0].producto.codigo, 'P-002');
  assert.deepEqual(e.llamadas[0].ids.sort(), [1, 2]); // el producto 3 no tiene fecha: no se estima su demanda
  assert.equal(e.llamadas[0].horizonte, 60); // hasta el vencimiento más lejano
  assert.equal(e.llamadas.length, 1);
});

test('servicio: el filtro por nivel solo afecta la lista, no el resumen', async () => {
  const e = entorno({
    productos: productosBase,
    lotes: [
      { id: 10, producto_id: 1, numero_lote: 'A1', cantidad_actual: 100, fecha_vencimiento: sumarDias(HOY, 60) },
      { id: 20, producto_id: 2, numero_lote: 'B1', cantidad_actual: 100, fecha_vencimiento: sumarDias(HOY, 30) },
    ],
    demandas: { 1: demanda({ porDia: 5 }), 2: demanda({ porDia: 1 }) },
  });
  const r = await analizarRiesgo({ nivel: 'alto', ahora: AHORA, repositorio: e.repositorio, predictor: e.predictor });
  assert.equal(r.productos.length, 1);
  assert.equal(r.resumen.lotes_analizados, 2);
});

test('servicio: nunca pide más de 180 días de demanda', async () => {
  const e = entorno({
    productos: productosBase,
    lotes: [{ id: 10, producto_id: 1, numero_lote: 'A1', cantidad_actual: 100, fecha_vencimiento: sumarDias(HOY, 400) }],
    demandas: { 1: demanda({ porDia: 1, dias: 180 }) },
  });
  await analizarRiesgo({ ahora: AHORA, repositorio: e.repositorio, predictor: e.predictor });
  assert.equal(e.llamadas[0].horizonte, 180);
});

test('servicio: sin lotes con stock devuelve un resumen vacío', async () => {
  const e = entorno({ productos: productosBase, lotes: [] });
  const r = await analizarRiesgo({ ahora: AHORA, repositorio: e.repositorio, predictor: e.predictor });
  assert.equal(r.resumen.lotes_analizados, 0);
  assert.deepEqual(r.productos, []);
  assert.equal(e.llamadas.length, 0);
});

test('TC-06: el riesgo se actualiza cuando cambian el stock, las ventas o la fecha de vencimiento', async () => {
  const datos = [{ id: 20, producto_id: 2, numero_lote: 'B1', cantidad_actual: 100, fecha_vencimiento: sumarDias(HOY, 30) }];
  const demandas = { 2: demanda({ porDia: 1 }) };
  const e = entorno({ productos: productosBase, lotes: datos, demandas });
  const consulta = () => analizarRiesgo({ ahora: AHORA, repositorio: e.repositorio, predictor: e.predictor });

  assert.equal((await consulta()).productos[0].nivel, 'alto'); // 70 % en riesgo

  datos[0].cantidad_actual = 25; // se vendió stock: ahora la demanda (30) lo cubre
  assert.equal((await consulta()).productos[0].nivel, 'bajo');

  datos[0].cantidad_actual = 100;
  demandas[2] = demanda({ porDia: 3 }); // suben las ventas
  assert.equal((await consulta()).productos[0].nivel, 'bajo');

  demandas[2] = demanda({ porDia: 1 });
  datos[0].fecha_vencimiento = sumarDias(HOY, 120); // se amplía el plazo
  assert.equal((await consulta()).productos[0].nivel, 'bajo');
});

test('controlador: valida producto_ids y nivel (ambos opcionales)', () => {
  assert.deepEqual(leerParametros({}), { ids: null, nivel: null });
  assert.deepEqual(leerParametros({ producto_ids: '2,3,3', nivel: 'ALTO' }), { ids: [2, 3], nivel: 'alto' });
  assert.equal(leerParametros({ nivel: 'datos_insuficientes' }).nivel, 'datos_insuficientes');
  assert.throws(() => leerParametros({ producto_ids: 'abc' }), /no son válidos/);
  assert.throws(() => leerParametros({ producto_ids: '0' }), /no son válidos/);
  assert.throws(() => leerParametros({ nivel: 'critico' }), /debe ser uno de/);
  const demasiados = Array.from({ length: MAX_PRODUCTOS + 1 }, (_, i) => i + 1).join(',');
  assert.throws(() => leerParametros({ producto_ids: demasiados }), /hasta 100 productos/);
});
