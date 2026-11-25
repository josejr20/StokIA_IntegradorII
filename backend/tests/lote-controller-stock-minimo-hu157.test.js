'use strict';

// HU-157 | BUG-01 y BUG-02: al registrar un movimiento desde loteController (con su propia transacción)
// debía evaluarse el stock mínimo después del commit. Los modelos y servicios están simulados:
// no se conecta a ninguna base de datos.

const test = require('node:test');
const assert = require('node:assert/strict');

const eventos = [];
const avisos = [];
const configuracion = { fallaEvaluacion: false, fallaMovimiento: null };

function simularModulo(ruta, exportaciones) {
  const archivo = require.resolve(ruta);
  require.cache[archivo] = { id: archivo, filename: archivo, loaded: true, exports: exportaciones };
  return archivo;
}

class ErrorKardex extends Error {}

const transaccionFalsa = {
  commit: async () => { eventos.push('commit'); },
  rollback: async () => { eventos.push('rollback'); },
};

const loteExistente = { id: 7, producto_id: 42 };

const archivosSimulados = [
  simularModulo('../src/models', {
    Lote: {
      findByPk: async () => loteExistente,
      sequelize: { transaction: async () => transaccionFalsa },
    },
    Producto: { findByPk: async () => ({ id: 42, activo: true }) },
    MovimientoInventario: {},
    Usuario: {},
  }),
  simularModulo('../src/dtos/loteDto', { LoteDto: {} }),
  simularModulo('../src/dtos/movimientoDto', { MovimientoDto: {} }),
  simularModulo('../src/services/kardexService', {
    ErrorKardex,
    registrarMovimiento: async () => {
      eventos.push('movimiento');
      if (configuracion.fallaMovimiento) throw configuracion.fallaMovimiento;
      return { id: 1, tipo: 'salida' };
    },
  }),
  simularModulo('../src/services/loteService', {
    ErrorLote: class ErrorLote extends Error {},
    generarCodigoLote: () => 'L-1',
    validarLoteParaCreacion: () => ({}),
    calcularFechaVencimiento: () => null,
  }),
  simularModulo('../src/utils/logger', {
    info() {}, error() {}, debug() {},
    warn: (mensaje) => avisos.push(mensaje),
  }),
  simularModulo('../src/services/wsService', { emitir() {}, broadcast() {} }),
  simularModulo('../src/services/umbralVencimientoService', { obtenerResolvedor: async () => () => ({}) }),
  simularModulo('../src/services/stockMinimoService', {
    evaluarAlertasStockMinimo: async (productoId) => {
      eventos.push(`evaluar:${productoId}`);
      if (configuracion.fallaEvaluacion) throw new Error('fallo simulado de la evaluación');
      return { creadas: 0 };
    },
  }),
];

const { registrarMovimientoCtrl } = require('../src/controllers/loteController');

test.after(() => {
  for (const archivo of archivosSimulados) delete require.cache[archivo];
});

test.beforeEach(() => {
  eventos.length = 0;
  avisos.length = 0;
  configuracion.fallaEvaluacion = false;
  configuracion.fallaMovimiento = null;
});

function crearRespuesta() {
  const respuesta = { codigo: 200, cuerpo: null };
  respuesta.status = (codigo) => { respuesta.codigo = codigo; return respuesta; };
  respuesta.json = (cuerpo) => { respuesta.cuerpo = cuerpo; return respuesta; };
  return respuesta;
}

function crearPeticion(cuerpo) {
  return { params: { id: 7 }, body: cuerpo, user: { id: 3 } };
}

test('BUG-01: una salida confirmada evalúa el stock mínimo del producto después del commit', async () => {
  const res = crearRespuesta();

  await registrarMovimientoCtrl(
    crearPeticion({ tipo: 'salida', cantidad: 5, motivo: 'Merma' }),
    res,
    (error) => { throw error; },
  );

  assert.deepEqual(eventos, ['movimiento', 'commit', 'evaluar:42']);
  assert.equal(res.codigo, 200);
  assert.deepEqual(res.cuerpo, { data: { id: 1, tipo: 'salida' } });
});

test('BUG-02: un ingreso confirmado también evalúa el stock para resolver la alerta existente', async () => {
  const res = crearRespuesta();

  await registrarMovimientoCtrl(
    crearPeticion({ tipo: 'ingreso', cantidad: 20 }),
    res,
    (error) => { throw error; },
  );

  assert.deepEqual(eventos, ['movimiento', 'commit', 'evaluar:42']);
  assert.equal(res.codigo, 200);
});

test('si la evaluación falla, el movimiento confirmado no se revierte y la respuesta sigue siendo exitosa', async () => {
  configuracion.fallaEvaluacion = true;
  const res = crearRespuesta();

  await registrarMovimientoCtrl(
    crearPeticion({ tipo: 'salida', cantidad: 5, motivo: 'Merma' }),
    res,
    (error) => { throw error; },
  );

  assert.equal(eventos.includes('rollback'), false);
  assert.equal(res.codigo, 200);
  assert.deepEqual(res.cuerpo, { data: { id: 1, tipo: 'salida' } });
  assert.equal(avisos.length, 1);
  assert.match(avisos[0], /stock mínimo del producto 42/);
});

test('si el movimiento falla, se revierte y no se evalúa el stock', async () => {
  configuracion.fallaMovimiento = new ErrorKardex('Stock insuficiente para registrar la salida');
  const res = crearRespuesta();

  await registrarMovimientoCtrl(
    crearPeticion({ tipo: 'salida', cantidad: 999, motivo: 'Merma' }),
    res,
    (error) => { throw error; },
  );

  assert.deepEqual(eventos, ['movimiento', 'rollback']);
  assert.equal(res.codigo, 400);
  assert.equal(eventos.some((evento) => evento.startsWith('evaluar')), false);
});