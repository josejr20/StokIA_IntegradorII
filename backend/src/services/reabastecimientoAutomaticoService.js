'use strict';

/**
 * HU-133 / US-26
 * Calcula la cantidad sugerida de reabastecimiento.
 * Esta función no modifica la base de datos.
 */
function calcularReabastecimiento({
    stockActual,
    stockMinimo,
    demandaEstimada,
}) {
    if (
        [stockActual, stockMinimo, demandaEstimada].some(
            valor => valor === null || valor === undefined || valor === ''
        )
    ) {
        throw new Error(
            'Faltan datos de inventario, stock mínimo o demanda estimada'
        );
    }
    const stock = Number(stockActual);
    const minimo = Number(stockMinimo);
    const demanda = Number(demandaEstimada);

    if (
        ![stock, minimo, demanda].every(Number.isFinite) ||
        [stock, minimo, demanda].some(valor => valor < 0)
    ) {
        throw new Error('Los valores de inventario y demanda deben ser válidos');
    }

    const stockBajoMinimo = stock < minimo;
    const riesgoQuiebre = demanda > stock;

    // TC-02 y TC-07: no generar órdenes innecesarias.
    if (!stockBajoMinimo || !riesgoQuiebre) {
        return {
            requiereReabastecimiento: false,
            cantidadSugerida: 0,
            stockBajoMinimo,
            riesgoQuiebre,
        };
    }

    // TC-04: cubrir la demanda estimada y conservar el stock mínimo.
    const cantidadSugerida = Math.ceil(
        Math.max(0, demanda + minimo - stock)
    );

    return {
        requiereReabastecimiento: true,
        cantidadSugerida,
        stockBajoMinimo,
        riesgoQuiebre,
    };
}

/**
 * HU-133 / US-26
 * Genera una orden sugerida cuando el producto requiere reposición.
 */

async function generarOrdenAutomatica({
    productoId,
    stockActual,
    stockMinimo,
    demandaEstimada,
    repositorio,
}) {
    const calculo = calcularReabastecimiento({
        stockActual,
        stockMinimo,
        demandaEstimada,
    });

    // TC-02 y TC-07: no crear órdenes innecesarias.
    if (!calculo.requiereReabastecimiento) {
        return {
            generada: false,
            motivo: 'reabastecimiento_no_necesario',
            ...calculo,
        };
    }

    // La comprobación de duplicados y la creación deben
    // ejecutarse dentro de la misma transacción.
    const guardarOrdenYAlerta = async (transaction = null) => {

        // Bloquear el producto para evitar que dos procesos
        // automáticos operen simultáneamente sobre él.
        if (transaction) {
            await repositorio.bloquearProducto(productoId, transaction);
        }

        // Verificar si existe una orden pendiente
        // utilizando la misma transacción.
        const ordenExistente = await repositorio.buscarOrdenPendiente(
            productoId,
            transaction
        );

        if (ordenExistente) {
            return {
                generada: false,
                motivo: 'orden_pendiente_existente',
                orden: ordenExistente,
            };
        }

        // TC-01, TC-05 y TC-06:
        // Crear la orden y su alerta en una misma transacción.
        const orden = await repositorio.crearOrden({
            producto_id: productoId,
            cantidad_sugerida: calculo.cantidadSugerida,
            generado_por: 'automatico',
            estado: 'pendiente',
        }, transaction);

        // La alerta es obligatoria cuando se genera una orden.
        if (typeof repositorio.crearAlertaReabastecimiento !== 'function') {
            throw new Error('No está disponible el registro de alertas');
        }

        await repositorio.crearAlertaReabastecimiento({
            productoId,
            ordenId: orden.id,
            cantidadSugerida: calculo.cantidadSugerida,
        }, transaction);

        return {
            generada: true,
            motivo: 'orden_generada',
            orden,
            ...calculo,
        };
    };

    if (typeof repositorio.ejecutarEnTransaccion === 'function') {
        return repositorio.ejecutarEnTransaccion(guardarOrdenYAlerta);
    }

    // Compatibilidad temporal con repositorios simulados.
    return guardarOrdenYAlerta();
}


/**
 * Calcula el stock utilizable de un producto,
 * excluyendo lotes agotados y vencidos.
 */
function calcularStockDisponible(lotes, hoy = new Date()) {
    const { seleccionarLotesFEFO } = require('./loteService');

    const lotesDisponibles = seleccionarLotesFEFO(lotes, hoy);

    return lotesDisponibles.reduce(
        (total, lote) => total + Number(lote.cantidad_actual),
        0
    );
}

/**
 * Selecciona el stock mínimo aplicable al producto.
 * Prioriza el umbral específico sobre el general.
 */
function obtenerStockMinimo(umbrales, productoId) {
    const aplicables = umbrales.filter(
        (umbral) => umbral.tipo === 'stock_minimo'
    );

    const especifico = aplicables.find(
        (umbral) => Number(umbral.producto_id) === Number(productoId)
    );

    const general = aplicables.find(
        (umbral) => umbral.producto_id == null
    );

    const seleccionado = especifico ?? general;

    if (!seleccionado) return null;

    const valor = Number(seleccionado.valor);

    return Number.isFinite(valor) && valor >= 0 ? valor : null;
}

/**
 * Evalúa si un producto necesita reabastecimiento.
 * No realiza escrituras en la base de datos.
 */
async function evaluarProducto({
    productoId,
    repositorio,
    obtenerPrediccion,
    horizonteDias = 7,
    hoy = new Date(),
}) {
    const [lotes, umbrales] = await Promise.all([
        repositorio.obtenerLotes(productoId),
        repositorio.obtenerUmbrales(),
    ]);

    const stockActual = calcularStockDisponible(lotes, hoy);
    const stockMinimo = obtenerStockMinimo(umbrales, productoId);

    if (stockMinimo === null) {
        return {
            productoId,
            estado: 'datos_insuficientes',
            motivo: 'stock_minimo_no_configurado',
        };
    }

    const prediccion = await obtenerPrediccion(productoId, horizonteDias);

    if (
        !prediccion ||
        prediccion.estado !== 'ok' ||
        prediccion.demanda_estimada == null
    ) {
        return {
            productoId,
            estado: 'datos_insuficientes',
            motivo: 'prediccion_no_disponible',
        };
    }

    const calculo = calcularReabastecimiento({
        stockActual,
        stockMinimo,
        demandaEstimada: prediccion.demanda_estimada,
    });

    return {
        productoId,
        estado: 'evaluado',
        stockActual,
        stockMinimo,
        demandaEstimada: Number(prediccion.demanda_estimada),
        horizonteDias,
        ...calculo,
    };
}

/**
 * HU-133 / US-26
 * Evalúa un producto y genera una orden sugerida si corresponde.
 */
async function procesarReabastecimiento({
    productoId,
    repositorio,
    obtenerPrediccion,
    horizonteDias = 7,
    hoy = new Date(),
}) {
    const evaluacion = await evaluarProducto({
        productoId,
        repositorio,
        obtenerPrediccion,
        horizonteDias,
        hoy,
    });

    // No generar órdenes cuando faltan datos.
    if (evaluacion.estado !== 'evaluado') {
        return {
            generada: false,
            motivo: evaluacion.motivo,
            evaluacion,
        };
    }

    // No generar órdenes cuando el stock es suficiente.
    if (!evaluacion.requiereReabastecimiento) {
        return {
            generada: false,
            motivo: 'reabastecimiento_no_necesario',
            evaluacion,
        };
    }

    const resultado = await generarOrdenAutomatica({
        productoId,
        stockActual: evaluacion.stockActual,
        stockMinimo: evaluacion.stockMinimo,
        demandaEstimada: evaluacion.demandaEstimada,
        repositorio,
    });

    return {
        ...resultado,
        evaluacion,
    };
}

module.exports = {
    calcularReabastecimiento,
    generarOrdenAutomatica,
    calcularStockDisponible,
    obtenerStockMinimo,
    evaluarProducto,
    procesarReabastecimiento,
};