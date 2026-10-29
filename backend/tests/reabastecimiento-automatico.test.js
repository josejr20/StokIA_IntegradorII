'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    generarOrdenAutomatica,
} = require('../src/services/reabastecimientoAutomaticoService');

test('TC-05: no genera una orden duplicada si ya existe una pendiente', async () => {
    let ordenesCreadas = 0;

    // Repositorio simulado: no conecta con Supabase.
    const repositorio = {
        buscarOrdenPendiente: async () => ({
            id: 15,
            producto_id: 1,
            estado: 'pendiente',
        }),

        crearOrden: async () => {
            ordenesCreadas++;
        },
    };

    const resultado = await generarOrdenAutomatica({
        productoId: 1,
        stockActual: 5,
        stockMinimo: 10,
        demandaEstimada: 20,
        repositorio,
    });

    assert.equal(resultado.generada, false);
    assert.equal(resultado.motivo, 'orden_pendiente_existente');
    assert.equal(ordenesCreadas, 0);
});

test('TC-01 y TC-05: genera una orden cuando hay riesgo de quiebre', async () => {
    const ordenesCreadas = [];
    const alertasCreadas = [];

    const repositorio = {
        buscarOrdenPendiente: async () => null,

        crearOrden: async (datos) => {
            const orden = { id: 20, ...datos };
            ordenesCreadas.push(orden);
            return orden;
        },

        crearAlertaReabastecimiento: async (datos) => {
            alertasCreadas.push(datos);
            return { id: 1, ...datos };
        },
    };

    const resultado = await generarOrdenAutomatica({
        productoId: 1,
        stockActual: 5,
        stockMinimo: 10,
        demandaEstimada: 20,
        repositorio,
    });

    assert.equal(resultado.generada, true);
    assert.equal(resultado.motivo, 'orden_generada');
    assert.equal(ordenesCreadas.length, 1);
    assert.equal(ordenesCreadas[0].producto_id, 1);
    assert.equal(alertasCreadas[0].ordenId, 20);
    assert.equal(ordenesCreadas[0].cantidad_sugerida, 25);
    assert.equal(ordenesCreadas[0].generado_por, 'automatico');
    assert.equal(ordenesCreadas[0].estado, 'pendiente');
});