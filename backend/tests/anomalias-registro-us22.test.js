'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  evaluarAnomalias,
  construirAlerta,
  ORIGEN_INTERNO,
} = require('../src/services/anomaliasRegistroService');

function serieVentas(producto = 1, inicio = 1, cantidades = [10, 11, 9, 10, 10, 100]) {
  return cantidades.map((cantidad, indice) => ({
    id: inicio + indice,
    producto_id: producto,
    cantidad: String(cantidad),
    origen: 'manual',
    fecha_venta: new Date(Date.UTC(2026, 9, indice + 1)),
  }));
}

function serieMovimientos(lote_id = 5, cantidades = [10, 11, 9, 10, 10, 100]) {
  return cantidades.map((cantidad, indice) => ({
    id: 100 + indice, lote_id, tipo: 'ingreso', origen: 'compra',
    cantidad: String(cantidad), fecha: new Date(Date.UTC(2026, 9, indice + 1)),
  }));
}

function crearMocks({ ventas = serieVentas(), movimientos = [], lotes = [] } = {}) {
  const Op = { in: Symbol('in'), gte: Symbol('gte'), lte: Symbol('lte'), contains: Symbol('contains') };
  const creadas = [];
  const llamadas = { ventas: 0, movimientos: 0, lotes: 0, lecturaAlertas: 0 };
  const deps = {
    Op,
    Venta: { async findAll(opciones) {
      llamadas.ventas++;
      assert.equal(opciones.limit, 20001);
      assert.ok(opciones.where.fecha_venta[Op.gte] instanceof Date);
      return ventas;
    } },
    MovimientoInventario: { async findAll() { llamadas.movimientos++; return movimientos; } },
    Lote: { async findAll() { llamadas.lotes++; return lotes; } },
    Alerta: {
      async findOne({ where }) {
        llamadas.lecturaAlertas++;
        const objetivo = where.datos_origen[Op.contains];
        return creadas.find((alerta) =>
          alerta.producto_id === where.producto_id &&
          alerta.datos_origen.origen === objetivo.origen &&
          alerta.datos_origen.fuente === objetivo.fuente &&
          alerta.datos_origen.registro_id === objetivo.registro_id
        ) ?? null;
      },
      async create(alerta) { creadas.push(alerta); return alerta; },
    },
  };
  return { deps, creadas, llamadas };
}

const ahora = new Date('2026-11-04T20:00:00.000Z');

test('HU-115: vista previa identifica una venta anomalamente alta sin escribir alertas', async () => {
  const { deps, creadas, llamadas } = crearMocks();
  const resultado = await evaluarAnomalias({ ahora }, deps);
  assert.equal(resultado.modo, 'vista_previa');
  assert.equal(resultado.anomalias_encontradas, 1);
  assert.equal(resultado.muestra_anomalias[0].registro_id, 6);
  assert.equal(creadas.length, 0);
  assert.equal(llamadas.lecturaAlertas, 0);
});

test('HU-115: registrar genera una alerta visible y enlazada al registro de venta', async () => {
  const { deps, creadas } = crearMocks();
  const resultado = await evaluarAnomalias({ ahora, guardar: true }, deps);
  assert.equal(resultado.alertas_creadas, 1);
  assert.equal(creadas[0].tipo, 'anomalia');
  assert.equal(creadas[0].estado, 'nueva');
  assert.equal(creadas[0].producto_id, 1);
  assert.equal(creadas[0].datos_origen.origen, ORIGEN_INTERNO);
  assert.equal(creadas[0].datos_origen.fuente, 'venta');
  assert.equal(creadas[0].datos_origen.registro_id, '6');
});

test('HU-115: segundo registro no duplica alertas existentes', async () => {
  const { deps, creadas } = crearMocks();
  await evaluarAnomalias({ ahora, guardar: true }, deps);
  const resultado = await evaluarAnomalias({ ahora, guardar: true }, deps);
  assert.equal(resultado.alertas_creadas, 0);
  assert.equal(resultado.alertas_ya_existentes, 1);
  assert.equal(creadas.length, 1);
});

test('HU-115: movimientos se vinculan con su lote y producto', async () => {
  const { deps, creadas, llamadas } = crearMocks({
    ventas: [],
    movimientos: serieMovimientos(),
    lotes: [{ id: 5, producto_id: 17 }],
  });
  const resultado = await evaluarAnomalias({ ahora, guardar: true }, deps);
  assert.equal(resultado.alertas_creadas, 1);
  assert.equal(creadas[0].producto_id, 17);
  assert.equal(creadas[0].lote_id, 5);
  assert.equal(creadas[0].datos_origen.fuente, 'movimiento');
  assert.equal(llamadas.lotes, 1);
});

test('HU-115: no consulta lotes cuando no hay movimientos', async () => {
  const { deps, llamadas } = crearMocks();
  await evaluarAnomalias({ ahora }, deps);
  assert.equal(llamadas.lotes, 0);
});

test('HU-115: limiteNuevas evita generar demasiadas alertas en una ejecucion', async () => {
  const { deps, creadas } = crearMocks({
    ventas: [...serieVentas(1, 1), ...serieVentas(2, 11)],
  });
  const primero = await evaluarAnomalias({ ahora, guardar: true, limiteNuevas: 1 }, deps);
  assert.equal(primero.alertas_creadas, 1);
  assert.equal(primero.pendientes_por_limite, 1);
  const segundo = await evaluarAnomalias({ ahora, guardar: true, limiteNuevas: 1 }, deps);
  assert.equal(segundo.alertas_creadas, 1);
  assert.equal(segundo.alertas_ya_existentes, 1);
  assert.equal(creadas.length, 2);
});

test('HU-115: no crea alertas sin historial suficiente', async () => {
  const { deps, creadas } = crearMocks({ ventas: serieVentas(1, 1, [10, 100]) });
  const resultado = await evaluarAnomalias({ ahora, guardar: true }, deps);
  assert.equal(resultado.anomalias_encontradas, 0);
  assert.equal(creadas.length, 0);
});

test('HU-115: opciones invalidas se rechazan antes de consultar BD', async () => {
  const { deps, llamadas } = crearMocks();
  await assert.rejects(evaluarAnomalias({ ahora, diasHistorial: 4 }, deps), /diasHistorial/);
  await assert.rejects(evaluarAnomalias({ ahora, limiteNuevas: 0 }, deps), /limiteNuevas/);
  await assert.rejects(evaluarAnomalias({ ahora, guardar: 'si' }, deps), /guardar/);
  assert.equal(llamadas.ventas, 0);
});

test('HU-115: rechaza historial truncado para evitar falsos positivos', async () => {
  const { deps, creadas } = crearMocks({ ventas: new Array(20001).fill(null).map((_, i) => ({ id: i + 1 })) });
  await assert.rejects(evaluarAnomalias({ ahora, guardar: true }, deps), (error) =>
    error.codigo === 'HISTORIAL_DEMASIADO_GRANDE');
  assert.equal(creadas.length, 0);
});

test('HU-115: alerta de movimiento incluye identificacion de origen y rango', () => {
  const alerta = construirAlerta({
    fuente: 'movimiento', registro_id: '9007199254740991', producto_id: 14,
    cantidad: 150, fecha: '2026-10-10T00:00:00.000Z',
    referencia_mediana: 10, limite_inferior: 0, limite_superior: 20,
  }, new Map([['9007199254740991', 4]]));
  assert.equal(alerta.datos_origen.registro_id, '9007199254740991');
  assert.equal(alerta.lote_id, 4);
  assert.equal(alerta.severidad, 'alta');
});
