'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    evaluarProducto
} = require('../src/services/reabastecimientoAutomaticoService');

test('HU-133: identifica un producto que necesita reabastecimiento', async () => {
    const repositorio = {
        obtenerLotes: async () => [
            {
                cantidad_actual: 5,
                fecha_vencimiento: null
            }
        ],
        obtenerUmbrales: async () => [
            {
                tipo: 'stock_minimo',
                producto_id: 1,
                valor: 10
            }
        ]
    };

    const obtenerPrediccion = async () => ({
        estado: 'ok',
        demanda_estimada: 20,
        horizonte_dias: 7
    });

    const resultado = await evaluarProducto({
        productoId: 1,
        repositorio,
        obtenerPrediccion
    });

    assert.equal(resultado.estado, 'evaluado');
    assert.equal(resultado.requiereReabastecimiento, true);
    assert.equal(resultado.cantidadSugerida, 25);
});

test('HU-133: no genera sugerencias si falta el stock minimo', async () => {
    const repositorio = {
        obtenerLotes: async () => [],
        obtenerUmbrales: async () => []
    };

    const obtenerPrediccion = async () => ({
        estado: 'ok',
        demanda_estimada: 20
    });

    const resultado = await evaluarProducto({
        productoId: 1,
        repositorio,
        obtenerPrediccion
    });

    assert.equal(resultado.estado, 'datos_insuficientes');
    assert.equal(resultado.motivo, 'stock_minimo_no_configurado');
});


test('HU-133: evalúa el producto y genera una orden con su alerta', async () => {
    const {
        procesarReabastecimiento
    } = require('../src/services/reabastecimientoAutomaticoService');

    const ordenes = [];
    const alertas = [];

    const repositorio = {
        obtenerLotes: async () => [
            {
                cantidad_actual: 5,
                fecha_vencimiento: null
            }
        ],

        obtenerUmbrales: async () => [
            {
                tipo: 'stock_minimo',
                producto_id: 1,
                valor: 10
            }
        ],

        ejecutarEnTransaccion: async (operacion) => {
            return operacion({ id: 'transaccion_simulada' });
        },

        bloquearProducto: async () => ({ id: 1 }),

        buscarOrdenPendiente: async () => {
            return ordenes.find(orden => orden.estado === 'pendiente') ?? null;
        },

        crearOrden: async (datos) => {
            const orden = { id: 1, ...datos };
            ordenes.push(orden);
            return orden;
        },

        crearAlertaReabastecimiento: async (datos) => {
            alertas.push(datos);
            return { id: 1, ...datos };
        }
    };

    const obtenerPrediccion = async () => ({
        estado: 'ok',
        demanda_estimada: 20,
        horizonte_dias: 7
    });

    const resultado = await procesarReabastecimiento({
        productoId: 1,
        repositorio,
        obtenerPrediccion
    });

    assert.equal(resultado.generada, true);
    assert.equal(resultado.motivo, 'orden_generada');
    assert.equal(resultado.evaluacion.cantidadSugerida, 25);
    assert.equal(ordenes.length, 1);
    assert.equal(ordenes[0].cantidad_sugerida, 25);
    assert.equal(alertas.length, 1);
    assert.equal(alertas[0].ordenId, ordenes[0].id);
});
