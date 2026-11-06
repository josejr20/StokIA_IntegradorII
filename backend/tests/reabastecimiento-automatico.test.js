'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    generarOrdenAutomatica,
} = require('../src/services/reabastecimientoAutomaticoService');

// Prueba: TC-05: no genera una orden duplicada si ya existe una pendiente.
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

// Prueba: TC-01 y TC-05: genera una orden cuando hay riesgo de quiebre.
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


// Prueba: TC-08: evita órdenes duplicadas durante ejecuciones simultáneas.
test('TC-08: evita órdenes duplicadas durante ejecuciones simultáneas', async () => {
    const ordenes = [];
    const alertas = [];
    let bloqueo = Promise.resolve();

    // Simula que las transacciones del mismo producto
    // se ejecutan una después de otra.
    const repositorio = {
        ejecutarEnTransaccion: async (operacion) => {
            const anterior = bloqueo;
            let liberar;

            bloqueo = new Promise((resolve) => {
                liberar = resolve;
            });

            await anterior;

            try {
                return await operacion({ id: 'transaccion_simulada' });
            } finally {
                liberar();
            }
        },

        bloquearProducto: async () => ({ id: 1 }),

        buscarOrdenPendiente: async () =>
            ordenes.find((orden) => orden.estado === 'pendiente') ?? null,

        crearOrden: async (datos) => {
            const orden = { id: ordenes.length + 1, ...datos };
            ordenes.push(orden);
            return orden;
        },

        crearAlertaReabastecimiento: async (datos) => {
            alertas.push(datos);
        },
    };

    const parametros = {
        productoId: 1,
        stockActual: 5,
        stockMinimo: 10,
        demandaEstimada: 20,
        repositorio,
    };

    const resultados = await Promise.all([
        generarOrdenAutomatica(parametros),
        generarOrdenAutomatica(parametros),
    ]);

    assert.equal(ordenes.length, 1);
    assert.equal(alertas.length, 1);
    assert.equal(resultados.filter((r) => r.generada).length, 1);
    assert.equal(
        resultados.filter((r) => r.motivo === 'orden_pendiente_existente').length,
        1
    );
});


// Prueba: HU-136 / TC-07: no genera orden ni notificación si el stock es suficiente.
test('HU-136 / TC-07: no genera orden ni notificación si el stock es suficiente', async () => {
    let ordenesCreadas = 0;
    let alertasCreadas = 0;
    let notificacionesEnviadas = 0;

    const repositorio = {
        buscarOrdenPendiente: async () => null,

        crearOrden: async () => {
            ordenesCreadas++;
        },

        crearAlertaReabastecimiento: async () => {
            alertasCreadas++;
        },

        notificarEncargadosInventario: async () => {
            notificacionesEnviadas++;
        }
    };

    const resultado = await generarOrdenAutomatica({
        productoId: 1,
        stockActual: 30,
        stockMinimo: 10,
        demandaEstimada: 20,
        repositorio
    });

    assert.equal(resultado.generada, false);
    assert.equal(resultado.motivo, 'reabastecimiento_no_necesario');
    assert.equal(ordenesCreadas, 0);
    assert.equal(alertasCreadas, 0);
    assert.equal(notificacionesEnviadas, 0);
});

// Prueba: HU-136 / TC-06: notifica al encargado cuando se genera una orden.
test('HU-136 / TC-06: notifica al encargado cuando se genera una orden', async () => {
    const ordenes = [];
    const alertas = [];
    const notificaciones = [];

    const repositorio = {
        buscarOrdenPendiente: async () => null,

        crearOrden: async (datos) => {
            const orden = { id: 40, ...datos };
            ordenes.push(orden);
            return orden;
        },

        crearAlertaReabastecimiento: async (datos) => {
            alertas.push(datos);
            return { id: 50, ...datos };
        },

        notificarEncargadosInventario: async (datos) => {
            notificaciones.push(datos);
        }
    };

    const resultado = await generarOrdenAutomatica({
        productoId: 1,
        stockActual: 5,
        stockMinimo: 10,
        demandaEstimada: 20,
        repositorio
    });

    assert.equal(resultado.generada, true);
    assert.equal(ordenes.length, 1);
    assert.equal(alertas.length, 1);
    assert.equal(notificaciones.length, 1);
    assert.equal(notificaciones[0].productoId, 1);
});
