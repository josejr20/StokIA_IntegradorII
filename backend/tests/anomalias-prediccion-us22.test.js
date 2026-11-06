'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  filtrarVentasPorAlertas,
  esAlertaVentaUS22,
} = require('../src/services/filtroAnomaliasPrediccion');
const { predecirProductos, predecirProducto } = require('../src/services/prediccionDemandaService');

const AHORA = new Date('2026-11-04T20:00:00.000Z');
const fecha = (dia) => new Date(Date.UTC(2026, 9, dia, 12));
function ventas(productoId = 7, cantidadDias = 21, ultima = 10) {
  return Array.from({ length: cantidadDias }, (_, i) => ({
    id: String(i + 1), producto_id: productoId,
    cantidad: String(i === cantidadDias - 1 ? ultima : 10),
    fecha_venta: fecha(i + 1),
  }));
}
function alerta(registroId, { productoId = 7, estado = 'nueva', fuente = 'venta',
  origen = 'us22_detector_local', tipo = 'anomalia' } = {}) {
  return { tipo, estado, producto_id: productoId,
    datos_origen: { origen, fuente, registro_id: String(registroId) } };
}
function repo(ventasConsulta, alertasConsulta = [], { productos = [{ id: 7, codigo: 'P-7', nombre: 'Prueba', activo: true }] } = {}) {
  const llamadas = { productos: 0, ventas: 0, alertas: 0 };
  return {
    llamadas,
    productos: async () => { llamadas.productos++; return productos; },
    ventas: async () => { llamadas.ventas++; return ventasConsulta; },
    alertas: async () => { llamadas.alertas++; return alertasConsulta; },
  };
}

test('HU-116: excluye solo una venta marcada, sin modificar las otras', () => {
  const datos = [
    { id: '1', producto_id: 7, cantidad: '10' },
    { id: '2', producto_id: 7, cantidad: '1000' },
    { id: '3', producto_id: 7, cantidad: '10' },
  ];
  const copia = JSON.stringify(datos);
  const resultado = filtrarVentasPorAlertas(datos, [alerta('2')]);
  assert.deepEqual(resultado.ventasValidas.map((v) => v.id), ['1', '3']);
  assert.equal(resultado.ventasExcluidas.length, 1);
  assert.equal(resultado.excluidosPorProducto.get('7'), 1);
  assert.equal(JSON.stringify(datos), copia);
});

test('HU-116: al descartar una alerta el dato vuelve a incluirse', () => {
  const listado = ventas(7, 7, 500);
  const resultado = filtrarVentasPorAlertas(listado, [alerta('7', { estado: 'descartada' })]);
  assert.equal(resultado.ventasValidas.length, listado.length);
  assert.equal(resultado.ventasExcluidas.length, 0);
});

test('HU-116: mantiene exclusion para alerta nueva, vista y atendida', () => {
  for (const estado of ['nueva', 'vista', 'atendida']) {
    const r = filtrarVentasPorAlertas(ventas(7, 7, 500), [alerta('7', { estado })]);
    assert.equal(r.ventasExcluidas.length, 1, estado);
  }
});

test('HU-116: no confunde anomalia de movimiento con venta del mismo ID', () => {
  const r = filtrarVentasPorAlertas(ventas(7, 7, 500), [alerta('7', { fuente: 'movimiento' })]);
  assert.equal(r.ventasExcluidas.length, 0);
});

test('HU-116: ignora alertas de otros origenes o tipos', () => {
  const r = filtrarVentasPorAlertas(ventas(7, 7, 500), [
    alerta('7', { origen: 'manual' }), alerta('7', { tipo: 'bajo_stock' }),
  ]);
  assert.equal(r.ventasExcluidas.length, 0);
});

test('HU-116: no afecta un producto distinto aunque tenga el mismo ID local', () => {
  const datos = [
    { id: 3, producto_id: 7, cantidad: 999 },
    { id: 3, producto_id: 8, cantidad: 10 },
  ];
  const r = filtrarVentasPorAlertas(datos, [alerta(3)]);
  assert.equal(r.ventasValidas.length, 1);
  assert.equal(r.ventasValidas[0].producto_id, 8);
});

test('HU-116: conserva correctamente identificadores BIGINT como texto', () => {
  const id = '90071992547409919999';
  const r = filtrarVentasPorAlertas([{ id, producto_id: 7 }], [alerta(id)]);
  assert.equal(r.ventasExcluidas[0].registro_id, id);
});

test('HU-116: con alertas repetidas no duplica la exclusion', () => {
  const r = filtrarVentasPorAlertas(ventas(7, 7, 500), [alerta(7), alerta(7)]);
  assert.equal(r.ventasExcluidas.length, 1);
});

test('HU-116: datos invalidos se rechazan explicitamente', () => {
  assert.throws(() => filtrarVentasPorAlertas(null, []), TypeError);
  assert.throws(() => filtrarVentasPorAlertas([], null), TypeError);
  assert.equal(esAlertaVentaUS22({ tipo: 'anomalia', estado: 'nueva' }), false);
});

test('HU-116: la prediccion usa ventas filtradas y reporta cuantas excluyo', async () => {
  const datos = ventas(7, 21, 1000);
  const sinFiltro = await predecirProductos([7], { ahora: AHORA, repositorio: repo(datos) });
  const conFiltroRepo = repo(datos, [alerta('21')]);
  const conFiltro = await predecirProductos([7], { ahora: AHORA, repositorio: conFiltroRepo });
  assert.equal(conFiltroRepo.llamadas.alertas, 1);
  assert.equal(conFiltro.resultados[0].estado, 'ok');
  assert.equal(conFiltro.resultados[0].historial.unidades, 200);
  assert.equal(sinFiltro.resultados[0].historial.unidades, 1200);
  assert.equal(conFiltro.calidad_datos.total_ventas_anomalas_excluidas, 1);
  assert.equal(conFiltro.resultados[0].calidad_datos.ventas_anomalas_excluidas, 1);
});

test('HU-116: si solo quedan pocos dias con ventas informa datos insuficientes', async () => {
  const datos = ventas(7, 14, 999);
  const alertas = Array.from({ length: 8 }, (_, i) => alerta(i + 1));
  const resultado = await predecirProductos([7], { ahora: AHORA, repositorio: repo(datos, alertas) });
  assert.equal(resultado.resultados[0].estado, 'datos_insuficientes');
  assert.equal(resultado.resultados[0].calidad_datos.ventas_anomalas_excluidas, 8);
});

test('HU-116: evita que un error consultando alertas genere prediccion contaminada', async () => {
  const fuente = repo(ventas());
  fuente.alertas = async () => { throw new Error('DB no disponible'); };
  await assert.rejects(predecirProductos([7], { ahora: AHORA, repositorio: fuente }), /DB no disponible/);
});

test('HU-116: soporta repositorio de pruebas legado sin metodo alertas', async () => {
  const fuente = repo(ventas());
  delete fuente.alertas;
  const resultado = await predecirProductos([7], { ahora: AHORA, repositorio: fuente });
  assert.equal(resultado.resultados[0].estado, 'ok');
  assert.equal(resultado.calidad_datos.total_ventas_anomalas_excluidas, 0);
});

test('HU-116: conserva la firma original predecirProducto', async () => {
  const resultado = await predecirProducto(7, 3, { ahora: AHORA, repositorio: repo(ventas()) });
  assert.equal(resultado.producto_id, 7);
  assert.equal(resultado.horizonte_dias, 3);
  assert.equal(resultado.modelo.nombre, 'Holt amortiguado con estacionalidad semanal');
});

test('HU-116: no altera el archivo de modelo predictivo ni los datos originales', async () => {
  const m = require('../src/services/prediccionDemandaModelo');
  const datos = ventas(7, 21, 800);
  const original = JSON.stringify(datos);
  const resultado = await predecirProductos([7], { ahora: AHORA, repositorio: repo(datos, [alerta(21)]) });
  assert.equal(typeof m.predecirDemanda, 'function');
  assert.equal(JSON.stringify(datos), original);
  assert.equal(resultado.resultados[0].modelo.version, '1.0.0');
});
