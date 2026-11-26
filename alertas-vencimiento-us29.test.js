'use strict';

/**
 * US-29 · HU-151 QA-01 (parte backend): casos TC-01 a TC-07 sobre el servicio de alertas
 * de vencimiento, con una "base de datos" en memoria (no toca Supabase).
 */

const test = require('node:test');
const assert = require('node:assert/strict');

// El sincronizador carga ../models de forma perezosa; se sustituye por un objeto vacío
// porque en estas pruebas el modelo Alerta se inyecta.
require.cache[require.resolve('../src/models')] = { id: 'models', filename: 'models', loaded: true, exports: {} };

const servicio = require('../src/services/alertaVencimientoService');
const { sincronizarAlertasRiesgo } = require('../src/services/notificacionAlertaService');

const Op = { in: '$in' };
const logger = { error() {}, info() {}, warn() {} };

/** Coincidencia mínima de filtros Sequelize usados por el servicio. */
function coincide(alerta, where = {}) {
  return Object.entries(where).every(([campo, condicion]) => {
    if (campo === 'datos_origen') {
      return Object.entries(condicion).every(([k, v]) => alerta.datos_origen?.[k] === v);
    }
    if (condicion && typeof condicion === 'object' && condicion[Op.in]) {
      return condicion[Op.in].includes(alerta[campo]);
    }
    return alerta[campo] === condicion;
  });
}

function crearAlertaModel(inicial = []) {
  const filas = [];
  const Alerta = {
    filas,
    findAll: async ({ where } = {}) => filas.filter((f) => coincide(f, where)),
    findByPk: async (id) => filas.find((f) => f.id === Number(id)) ?? null,
    create: async (datos) => {
      const fila = {
        id: filas.length + 1,
        fecha_creacion: new Date(),
        ...datos,
        update: async function update(cambios) { Object.assign(this, cambios); },
      };
      filas.push(fila);
      return fila;
    },
  };
  inicial.forEach((a) => Alerta.create(a));
  return Alerta;
}

function alertaBase(extra = {}) {
  return {
    tipo: 'riesgo_vencimiento',
    producto_id: 4,
    lote_id: 12,
    mensaje: 'Riesgo alto: 15 de 20 unidades no se venderían antes de vencer',
    severidad: 'alta',
    estado: 'nueva',
    datos_origen: {
      origen: 'riesgo_vencimiento',
      codigo: 'P-004',
      nombre: 'Leche entera 1L',
      numero_lote: 'L-12',
      fecha_vencimiento: '2026-12-01',
      dias_para_vencer: 5,
      unidades_en_riesgo: 15,
      mensaje: 'Riesgo alto: 15 de 20 unidades no se venderían antes de vencer',
      factores: ['Demanda baja'],
    },
    ...extra,
  };
}

function productoRiesgo(nivel = 'alto') {
  return [{
    producto_id: 4,
    producto: { codigo: 'P-004', nombre: 'Leche entera 1L' },
    lotes: [{
      lote_id: 12, numero_lote: 'L-12', fecha_vencimiento: '2026-12-01', dias_para_vencer: 5,
      stock: 20, estado: 'ok', nivel, mensaje: `Riesgo ${nivel}`, unidades_en_riesgo: 15,
      porcentaje_en_riesgo: 75, demanda_hasta_vencimiento: 5, factores: [],
    }],
  }];
}

test('TC-01/TC-03/TC-04: lista solo riesgo alto activo e indica producto, lote y motivo', async () => {
  const Alerta = crearAlertaModel([
    alertaBase(),
    alertaBase({ lote_id: 13, severidad: 'media' }),                  // media: no se muestra
    alertaBase({ lote_id: 14, estado: 'atendida' }),                   // atendida: no se muestra
    alertaBase({ lote_id: 15, tipo: 'bajo_stock' }),                   // otro tipo: no se muestra
  ]);

  const alertas = await servicio.listarActivas({ Alerta, Op });

  assert.equal(alertas.length, 1);
  assert.equal(alertas[0].severidad, 'alta');
  assert.equal(alertas[0].producto.nombre, 'Leche entera 1L');
  assert.equal(alertas[0].producto.codigo, 'P-004');
  assert.equal(alertas[0].lote.numero, 'L-12');
  assert.match(alertas[0].motivo, /Riesgo alto/);
});

test('TC-01: las alertas más urgentes (vencen antes) aparecen primero', async () => {
  const lejana = alertaBase({ lote_id: 20 });
  lejana.datos_origen = { ...lejana.datos_origen, dias_para_vencer: 30 };
  const cercana = alertaBase({ lote_id: 21 });
  cercana.datos_origen = { ...cercana.datos_origen, dias_para_vencer: 2 };
  const Alerta = crearAlertaModel([lejana, cercana]);

  const alertas = await servicio.listarActivas({ Alerta, Op });
  assert.deepEqual(alertas.map((a) => a.lote.id), [21, 20]);
});

test('TC-02/TC-07: sin riesgo alto indica que no hay alertas activas', async () => {
  const Alerta = crearAlertaModel();
  const resultado = await servicio.refrescarYListar({ usuarioId: 1 }, {
    Alerta, Op, logger, emitir() {},
    analizarRiesgo: async () => ({ productos: productoRiesgo('bajo') }),
    sincronizar: (p, o) => sincronizarAlertasRiesgo(p, { ...o, Alerta, notificarAlerta: async () => {}, logger }),
  });

  assert.equal(resultado.total, 0);
  assert.equal(resultado.hay_alertas, false);
  assert.deepEqual(resultado.alertas, []);
});

test('TC-01/TC-06: el recálculo crea la alerta de riesgo alto y avisa por WebSocket', async () => {
  const Alerta = crearAlertaModel();
  const eventos = [];
  const deps = {
    Alerta, Op, logger,
    emitir: (evento, datos) => eventos.push({ evento, datos }),
    analizarRiesgo: async () => ({ productos: productoRiesgo('alto') }),
    sincronizar: (p, o) => sincronizarAlertasRiesgo(p, { ...o, Alerta, notificarAlerta: async () => {}, logger }),
  };

  const primero = await servicio.refrescarYListar({ usuarioId: 1 }, deps);
  assert.equal(primero.total, 1);
  assert.equal(primero.hay_alertas, true);
  assert.equal(eventos.length, 1);
  assert.equal(eventos[0].evento, servicio.EVENTO_ALERTAS_ACTUALIZADAS);

  // Sin cambios no se vuelve a emitir (evita bucles entre clientes).
  await servicio.refrescarYListar({ usuarioId: 1 }, deps);
  assert.equal(eventos.length, 1);
  assert.equal(Alerta.filas.length, 1, 'no debe duplicar la alerta');
});

test('TC-05/TC-06: marcar como atendida la quita de activas, registra quién y avisa', async () => {
  const Alerta = crearAlertaModel([alertaBase()]);
  const eventos = [];
  const ahora = new Date('2026-11-26T15:00:00Z');

  const dto = await servicio.marcarAtendida(1, { usuarioId: 9 }, {
    Alerta, Op, logger, ahora: () => ahora, emitir: (e, d) => eventos.push({ e, d }),
  });

  assert.equal(dto.estado, 'atendida');
  assert.equal(Alerta.filas[0].fecha_atendida, ahora);
  assert.equal(Alerta.filas[0].datos_origen.atencion, 'manual');
  assert.equal(Alerta.filas[0].datos_origen.atendida_por, 9);
  assert.deepEqual(eventos, [{ e: servicio.EVENTO_ALERTAS_ACTUALIZADAS, d: { motivo: 'atendida', alertaId: 1 } }]);
  assert.equal((await servicio.listarActivas({ Alerta, Op })).length, 0);
});

test('TC-05: atender es idempotente y responde 404 si la alerta no existe', async () => {
  const Alerta = crearAlertaModel([alertaBase()]);
  const deps = { Alerta, Op, logger, emitir() {} };
  await servicio.marcarAtendida(1, { usuarioId: 9 }, deps);
  const otra = await servicio.marcarAtendida(1, { usuarioId: 10 }, deps);
  assert.equal(otra.estado, 'atendida');
  assert.equal(Alerta.filas[0].datos_origen.atendida_por, 9, 'conserva quien la atendió primero');

  await assert.rejects(() => servicio.marcarAtendida(999, {}, deps), (e) => e.status === 404);
});

test('TC-05: una alerta atendida a mano no reaparece mientras el riesgo siga igual', async () => {
  const Alerta = crearAlertaModel();
  const sincronizar = (p) => sincronizarAlertasRiesgo(p, { Alerta, notificarAlerta: async () => {}, logger });

  await sincronizar(productoRiesgo('alto'));
  await servicio.marcarAtendida(1, { usuarioId: 9 }, { Alerta, Op, logger, emitir() {} });

  const resultado = await sincronizar(productoRiesgo('alto'));
  assert.equal(resultado.creadas, 0, 'no debe recrear la alerta atendida');
  assert.equal(Alerta.filas.length, 1);
});

test('TC-05: si el riesgo desaparece y vuelve, la alerta se genera de nuevo', async () => {
  const Alerta = crearAlertaModel();
  const sincronizar = (p) => sincronizarAlertasRiesgo(p, { Alerta, notificarAlerta: async () => {}, logger });

  await sincronizar(productoRiesgo('alto'));
  await servicio.marcarAtendida(1, { usuarioId: 9 }, { Alerta, Op, logger, emitir() {} });
  await sincronizar(productoRiesgo('bajo'));                 // el riesgo se resolvió
  const vuelve = await sincronizar(productoRiesgo('alto'));  // y reaparece

  assert.equal(vuelve.creadas, 1);
  assert.equal(Alerta.filas.length, 2);
});

test('el cierre automático por riesgo resuelto queda marcado como automático', async () => {
  const Alerta = crearAlertaModel();
  const sincronizar = (p) => sincronizarAlertasRiesgo(p, { Alerta, notificarAlerta: async () => {}, logger });
  await sincronizar(productoRiesgo('alto'));
  await sincronizar(productoRiesgo('bajo'));
  assert.equal(Alerta.filas[0].estado, 'atendida');
  assert.equal(Alerta.filas[0].datos_origen.atencion, 'automatica');
});

test('si el motor de riesgo falla se devuelve lo guardado y se marca sincronizado=false', async () => {
  const Alerta = crearAlertaModel([alertaBase()]);
  const resultado = await servicio.refrescarYListar({ usuarioId: 1 }, {
    Alerta, Op, logger, emitir() {},
    analizarRiesgo: async () => { throw new Error('ML caído'); },
    sincronizar: async () => {},
  });
  assert.equal(resultado.sincronizado, false);
  assert.equal(resultado.total, 1);
});

test('llamadas simultáneas comparten un solo cálculo (sin alertas duplicadas)', async () => {
  const Alerta = crearAlertaModel();
  let calculos = 0;
  const deps = {
    Alerta, Op, logger, emitir() {},
    analizarRiesgo: async () => { calculos++; await new Promise((r) => setTimeout(r, 20)); return { productos: productoRiesgo('alto') }; },
    sincronizar: (p, o) => sincronizarAlertasRiesgo(p, { ...o, Alerta, notificarAlerta: async () => {}, logger }),
  };
  const [a, b] = await Promise.all([
    servicio.refrescarYListar({ usuarioId: 1 }, deps),
    servicio.refrescarYListar({ usuarioId: 2 }, deps),
  ]);
  assert.equal(calculos, 1);
  assert.equal(Alerta.filas.length, 1);
  assert.equal(a.total, b.total);
});
