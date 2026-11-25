'use strict';


const test = require('node:test');
const assert = require('node:assert/strict');

const { construirResumenInicio } = require('../src/services/resumenInicioService');

const AHORA = new Date('2026-11-25T10:00:00-05:00');

function permisos(...codigos) {
  return { todos: false, codigos: new Set(codigos) };
}
const ADMIN = { todos: true, codigos: new Set() };

function crearRepositorio(sobrescribir = {}) {
  const llamadas = [];
  const registrar = (nombre, valor) => async (...args) => {
    llamadas.push(nombre);
    return typeof valor === 'function' ? valor(...args) : valor;
  };
  const repositorio = {
    contarProductosActivos: registrar('contarProductosActivos', 40),
    ventasDelMes: registrar('ventasDelMes', 120),
    contarAlertasActivas: registrar('contarAlertasActivas', (filtro) => {
      if (filtro.severidad === 'critica') return 1;
      if (filtro.tipo === 'bajo_stock') return 2;
      return 4;
    }),
    contarOrdenesPendientes: registrar('contarOrdenesPendientes', 3),
    alertasRecientes: registrar('alertasRecientes', [
      { id: 1, tipo: 'bajo_stock', severidad: 'media', mensaje: 'Stock bajo de Leche', estado: 'nueva' },
    ]),
    productosMasVendidos: registrar('productosMasVendidos', [1, 2, 3, 4]),
    stockPorProducto: registrar('stockPorProducto', new Map([[1, 10], [2, 100], [3, 0]])),
    predecir: registrar('predecir', {
      resultados: [
        { producto_id: 1, producto: { codigo: 'P-001', nombre: 'Leche' }, estado: 'ok', demanda_estimada: 50, tendencia: 'sube' },
        { producto_id: 2, producto: { codigo: 'P-002', nombre: 'Arroz' }, estado: 'ok', demanda_estimada: 5, tendencia: 'estable' },
        { producto_id: 3, producto: { codigo: 'P-003', nombre: 'Aceite' }, estado: 'ok', demanda_estimada: 20, tendencia: 'sube' },
        { producto_id: 4, producto: { codigo: 'P-004', nombre: 'Sal' }, estado: 'datos_insuficientes' },
      ],
    }),
    ...sobrescribir,
  };
  return { repositorio, llamadas };
}

test('TC-01 / TC-03: un administrador ve todos los indicadores, alertas y predicciones', async () => {
  const { repositorio } = crearRepositorio();
  const resumen = await construirResumenInicio({ permisos: ADMIN, repositorio, ahora: AHORA });

  assert.deepEqual(Object.keys(resumen.kpis).sort(), [
    'alertas_activas', 'alertas_criticas', 'ordenes_pendientes', 'productos_activos', 'stock_bajo', 'ventas_mes_actual',
  ]);
  assert.equal(resumen.kpis.alertas_activas, 4);
  assert.equal(resumen.kpis.alertas_criticas, 1);
  assert.equal(resumen.kpis.stock_bajo, 2);
  assert.equal(resumen.alertas_recientes.length, 1);
  assert.equal(resumen.predicciones_relevantes.length, 2);
  assert.equal(resumen.hay_novedades, true);
});

test('TC-03: un usuario de ventas solo recibe lo que su rol permite y no se consulta lo demás', async () => {
  const { repositorio, llamadas } = crearRepositorio();
  const resumen = await construirResumenInicio({ permisos: permisos('gestionar_ventas'), repositorio, ahora: AHORA });

  assert.deepEqual(Object.keys(resumen.kpis), ['ventas_mes_actual']);
  assert.deepEqual(resumen.alertas_recientes, []);
  assert.deepEqual(resumen.predicciones_relevantes, []);
  assert.deepEqual(llamadas, ['ventasDelMes']);
});

test('TC-03: un encargado de inventario ve alertas y stock bajo, pero no predicciones', async () => {
  const { repositorio, llamadas } = crearRepositorio();
  const resumen = await construirResumenInicio({
    permisos: permisos('gestionar_inventario', 'ver_alertas'),
    repositorio,
    ahora: AHORA,
  });

  assert.deepEqual(Object.keys(resumen.kpis).sort(), ['alertas_activas', 'alertas_criticas', 'productos_activos', 'stock_bajo']);
  assert.equal(resumen.alertas_recientes.length, 1);
  assert.deepEqual(resumen.predicciones_relevantes, []);
  assert.equal(llamadas.includes('predecir'), false);
});

test('TC-04: las predicciones relevantes son las que superan el stock, ordenadas por faltante', async () => {
  const { repositorio } = crearRepositorio();
  const resumen = await construirResumenInicio({ permisos: permisos('ver_kpis'), repositorio, ahora: AHORA });

  // Leche: 50 - 10 = 40 faltan; Aceite: 20 - 0 = 20 faltan; Arroz (stock de sobra) y Sal (sin datos) no aparecen.
  assert.deepEqual(
    resumen.predicciones_relevantes.map((p) => [p.producto_id, p.faltante]),
    [[1, 40], [3, 20]],
  );
  assert.equal(resumen.predicciones_relevantes[0].nombre, 'Leche');
  assert.equal(resumen.predicciones_relevantes[0].horizonte_dias, 7);
});

test('TC-04: se muestran como máximo 3 predicciones', async () => {
  const resultados = [1, 2, 3, 4, 5].map((id) => ({
    producto_id: id, producto: { codigo: `P-${id}`, nombre: `Producto ${id}` }, estado: 'ok', demanda_estimada: 100 + id,
  }));
  const { repositorio } = crearRepositorio({
    productosMasVendidos: async () => [1, 2, 3, 4, 5],
    stockPorProducto: async () => new Map(),
    predecir: async () => ({ resultados }),
  });
  const resumen = await construirResumenInicio({ permisos: ADMIN, repositorio, ahora: AHORA });

  assert.equal(resumen.predicciones_relevantes.length, 3);
  assert.deepEqual(resumen.predicciones_relevantes.map((p) => p.producto_id), [5, 4, 3]);
});

test('TC-02 / TC-07: sin alertas ni predicciones pendientes se indica que no hay novedades', async () => {
  const { repositorio } = crearRepositorio({
    alertasRecientes: async () => [],
    productosMasVendidos: async () => [],
  });
  const resumen = await construirResumenInicio({ permisos: ADMIN, repositorio, ahora: AHORA });

  assert.deepEqual(resumen.alertas_recientes, []);
  assert.deepEqual(resumen.predicciones_relevantes, []);
  assert.equal(resumen.hay_novedades, false);
});

test('un usuario sin permisos recibe un resumen vacío y no se consulta nada', async () => {
  const { repositorio, llamadas } = crearRepositorio();
  const resumen = await construirResumenInicio({ permisos: permisos(), repositorio, ahora: AHORA });

  assert.deepEqual(resumen.kpis, {});
  assert.equal(resumen.hay_novedades, false);
  assert.deepEqual(llamadas, []);
});

test('si la predicción falla, el resumen se entrega igual con las alertas y se registra el aviso', async () => {
  const avisos = [];
  const { repositorio } = crearRepositorio({
    predecir: async () => { throw new Error('modelo no disponible'); },
  });
  const resumen = await construirResumenInicio({
    permisos: ADMIN,
    repositorio,
    ahora: AHORA,
    logger: { warn: (mensaje) => avisos.push(mensaje) },
  });

  assert.deepEqual(resumen.predicciones_relevantes, []);
  assert.equal(resumen.alertas_recientes.length, 1);
  assert.equal(resumen.hay_novedades, true);
  assert.equal(avisos.length, 1);
  assert.match(avisos[0], /modelo no disponible/);
});

test('TC-06: cada llamada consulta el repositorio de nuevo y devuelve un resumen actualizado', async () => {
  let alertas = [{ id: 1, tipo: 'bajo_stock', severidad: 'media', mensaje: 'A', estado: 'nueva' }];
  const { repositorio } = crearRepositorio({ alertasRecientes: async () => alertas, productosMasVendidos: async () => [] });

  const primero = await construirResumenInicio({ permisos: ADMIN, repositorio, ahora: AHORA });
  alertas = [];
  const segundo = await construirResumenInicio({ permisos: ADMIN, repositorio, ahora: new Date(AHORA.getTime() + 60000) });

  assert.equal(primero.alertas_recientes.length, 1);
  assert.equal(segundo.alertas_recientes.length, 0);
  assert.notEqual(primero.generado_en, segundo.generado_en);
});