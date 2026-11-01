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