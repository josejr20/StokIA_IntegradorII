
'use strict';

const cron = require('node-cron');

const repositorio = require('./reabastecimientoRepositorio');
const {
    evaluarProducto,
    procesarReabastecimiento
} = require('./reabastecimientoAutomaticoService');
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
 * Procesa automáticamente los productos y genera órdenes
 * únicamente cuando se ha habilitado de forma explícita.
 *
 * Permite inyectar un repositorio y un predictor simulados
 * para realizar pruebas sin utilizar Supabase.
 */
async function ejecutarReabastecimientoAutomatico({
    repo = repositorio,
    predecir = (id, horizonte) =>
        mlClient.obtenerPrediccion(id, horizonte),
    habilitado = process.env.REABASTECIMIENTO_GENERAR_ORDENES === 'true'
} = {}) {
    if (!habilitado) {
        console.log('[HU-135] Generación real desactivada');
        return { estado: 'desactivado' };
    }

    const productos = await repo.obtenerProductosActivos();

    const resumen = {
        evaluados: 0,
        ordenesGeneradas: 0,
        errores: 0
    };

    for (const producto of productos) {
        try {
            const resultado = await procesarReabastecimiento({
                productoId: producto.id,
                repositorio: repo,
                obtenerPrediccion: predecir
            });

            resumen.evaluados++;

            if (resultado.generada) {
                resumen.ordenesGeneradas++;
            }
        } catch (error) {
            resumen.errores++;
            console.error(
                `[HU-135] Error en producto ${producto.id}:`,
                error.message
            );
        }
    }

    console.log('[HU-135] Procesamiento finalizado:', resumen);
    return resumen;
}

/**
 * Programa la evaluación diaria a las 08:00, hora de Perú.
 *
 * Por defecto ejecuta solo una simulación.
 * La generación de órdenes requiere habilitación explícita.
 *
 * El inicio de este cron se controla desde app.js.
 */
function iniciarReabastecimientoCron() {
    return cron.schedule(
        '0 8 * * *',
        async () => {
            try {
                if (process.env.REABASTECIMIENTO_GENERAR_ORDENES === 'true') {
                    await ejecutarReabastecimientoAutomatico();
                } else {
                    await simularReabastecimiento();
                }
            } catch (error) {
                console.error(
                    '[HU-135] Error en tarea programada:',
                    error
                );
            }
        },
        {
            timezone: 'America/Lima'
        }
    );
}

module.exports = {
    simularReabastecimiento,
    ejecutarReabastecimientoAutomatico,
    iniciarReabastecimientoCron
};
