'use strict';

const {
    sequelize,
    Producto,
    Lote,
    UmbralConfiguracion,
    OrdenReabastecimiento,
} = require('../models');

/**
 * HU-133 / US-26
 * Consultas necesarias para generar órdenes automáticas.
 */

// Consultar productos activos.
async function obtenerProductosActivos() {
    return Producto.findAll({
        where: { activo: true },
        attributes: ['id', 'codigo', 'nombre'],
        raw: true,
    });
}

// Consultar los lotes de un producto.
async function obtenerLotes(productoId) {
    return Lote.findAll({
        where: { producto_id: productoId },
        raw: true,
    });
}

// Consultar los umbrales de stock mínimo.
async function obtenerUmbrales() {
    return UmbralConfiguracion.findAll({
        where: { tipo: 'stock_minimo' },
        raw: true,
    });
}

// Bloquear el producto durante la generación de una orden automática.
// Evita que dos procesos que utilicen este bloqueo operen
// simultáneamente sobre el mismo producto.
async function bloquearProducto(productoId, transaction) {
    if (!transaction) {
        throw new Error('Se requiere una transacción para bloquear el producto');
    }

    const producto = await Producto.findByPk(productoId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
    });

    if (!producto) {
        throw new Error(`No existe el producto ${productoId}`);
    }

    return producto;
}

// Verificar si ya existe una orden pendiente.
async function buscarOrdenPendiente(productoId, transaction = null) {
    return OrdenReabastecimiento.findOne({
        where: {
            producto_id: productoId,
            estado: 'pendiente',
        },
        transaction,
    });
}

// Guardar una orden automática.
async function crearOrden(datos, transaction = null) {
    return OrdenReabastecimiento.create({
        producto_id: datos.producto_id,
        cantidad_sugerida: datos.cantidad_sugerida,
        generado_por: 'automatico',
        estado: 'pendiente',
    }, { transaction });
}

/**
 * Registra una alerta cuando se genera
 * una orden automática de reabastecimiento.
 */
async function crearAlertaReabastecimiento({
    productoId,
    ordenId,
    cantidadSugerida,
}, transaction = null) {
    const { Alerta } = require('../models');

    return Alerta.create({
        tipo: 'bajo_stock',
        producto_id: productoId,
        mensaje:
            `Se generó automáticamente una orden de reabastecimiento ` +
            `por ${cantidadSugerida} unidades para el producto ${productoId}.`,
        severidad: 'alta',
        estado: 'nueva',
        datos_origen: {
            origen: 'reabastecimiento_automatico',
            orden_id: ordenId,
        },
    }, { transaction });
}


// Ejecutar operaciones dentro de una transacción.
// Si alguna falla, Sequelize revierte todos los cambios.
async function ejecutarEnTransaccion(operacion) {
    return sequelize.transaction(async (transaction) => {
        return operacion(transaction);
    });
}


module.exports = {
    obtenerProductosActivos,
    obtenerLotes,
    obtenerUmbrales,
    bloquearProducto,
    buscarOrdenPendiente,
    crearOrden,
    crearAlertaReabastecimiento,
    ejecutarEnTransaccion,
};