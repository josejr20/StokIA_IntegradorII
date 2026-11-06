'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');
const { Operacion } = require('../../src/models');
const {
  listarComprobantesAgrupados,
  obtenerComprobanteAgrupado,
} = require('../../src/services/comprobanteAgrupadoService');

const operaciones = [
  {
    id: 1,
    numero: 'V-013932',
    fecha: new Date('2026-11-04T05:30:00.000Z'),
    cliente_id: 7,
    cliente: { id: 7, nombre: 'A & A GROUP PERU S.A.C.', documento: '20123456789' },
    usuario: null,
    detalles: [],
    subtotal: '100.00',
    impuesto: '0.00',
    total: '100.00',
  },
  {
    id: 2,
    numero: 'V-014378',
    fecha: new Date('2026-11-05T04:30:00.000Z'),
    cliente_id: 7,
    cliente: { id: 7, nombre: 'A & A GROUP PERU S.A.C.', documento: '20123456789' },
    usuario: null,
    detalles: [],
    subtotal: '200.00',
    impuesto: '0.00',
    total: '200.00',
  },
];

test('agrupa por fecha de Lima y consulta el día completo de Lima', async (t) => {
  const findAllOriginal = Operacion.findAll;
  let opcionesConsulta;
  Operacion.findAll = async (opciones) => {
    opcionesConsulta = opciones;
    return operaciones;
  };
  t.after(() => {
    Operacion.findAll = findAllOriginal;
  });

  const comprobantes = await listarComprobantesAgrupados({ fecha: '2026-11-04' });

  assert.equal(opcionesConsulta.where.fecha[Op.gte].toISOString(), '2026-11-04T05:00:00.000Z');
  assert.equal(opcionesConsulta.where.fecha[Op.lt].toISOString(), '2026-11-05T05:00:00.000Z');
  assert.equal(comprobantes.length, 1);
  assert.equal(comprobantes[0].fecha, '2026-11-04');
  assert.equal(comprobantes[0].operaciones_count, 2);
  assert.deepEqual(comprobantes[0].numeros_operacion, ['V-013932', 'V-014378']);
  assert.equal(comprobantes[0].total, 300);

  const comprobante = await obtenerComprobanteAgrupado(comprobantes[0].id);
  assert.equal(comprobante.total, comprobantes[0].total);
  assert.equal(comprobante.numero_operacion, '2 operaciones');
  assert.equal(comprobante.fecha, operaciones[0].fecha);
  assert.deepEqual(comprobante.operaciones, comprobantes[0].numeros_operacion);
});
