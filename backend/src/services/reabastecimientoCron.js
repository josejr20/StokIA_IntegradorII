'use strict';

const cron = require('node-cron');

const repositorio = require('./reabastecimientoRepositorio');
const { evaluarProducto } = require('./reabastecimientoAutomaticoService');
const mlClient = require('../ml_client');

/**
 * Evalúa los productos activos sin generar órdenes.
 * Modo seguro para desarrollo y pruebas.
 */
async function simularReabastecimiento() {
    console.log('[HU-133] Iniciando simulación de reabastecimiento');

    const productos = await repositorio.obtenerProductosActivos();

    const resumen = {
        evaluados: 0,
        requierenReabastecimiento: 0,
        datosInsuficientes: 0,
        errores: 0
    };

    for (const producto of productos) {
        try {
            const resultado = await evaluarProducto({
                productoId: producto.id,
                repositorio,
                obtenerPrediccion: (id, horizonte) =>
                    mlClient.obtenerPrediccion(id, horizonte)
            });

            resumen.evaluados++;

            if (resultado.estado === 'datos_insuficientes') {
                resumen.datosInsuficientes++;
            } else if (resultado.requiereReabastecimiento) {
                resumen.requierenReabastecimiento++;
            }
        } catch (error) {
            resumen.errores++;
            console.error(
                `[HU-133] Error evaluando producto ${producto.id}:`,
                error.message
            );
        }
    }

    console.log('[HU-133] Simulación finalizada:', resumen);

    return resumen;
}

/**
 * Registra la tarea programada.
 * No se ejecuta automáticamente al importar este archivo.
 */
function iniciarReabastecimientoCron() {
    // Todos los días a las 08:00, hora de Perú.
    return cron.schedule(
        '0 8 * * *',
        async () => {
            try {
                await simularReabastecimiento();
            } catch (error) {
                console.error('[HU-133] Error en tarea programada:', error);
            }
        },
        {
            timezone: 'America/Lima'
        }
    );
}

module.exports = {
    simularReabastecimiento,
    iniciarReabastecimientoCron
};