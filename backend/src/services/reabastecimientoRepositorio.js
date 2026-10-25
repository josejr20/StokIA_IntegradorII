'use strict';

const {
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

// Verificar si ya existe una orden pendiente.
async function buscarOrdenPendiente(productoId) {
    return OrdenReabastecimiento.findOne({
        where: {
            producto_id: productoId,
            estado: 'pendiente',
        },
    });
}

// Guardar una orden automática.
async function crearOrden(datos) {
    return OrdenReabastecimiento.create({
        producto_id: datos.producto_id,
        cantidad_sugerida: datos.cantidad_sugerida,
        generado_por: 'automatico',
        estado: 'pendiente',
    });
}

/**
 * Registra una alerta cuando se genera
 * una orden automática de reabastecimiento.
 */
async function crearAlertaReabastecimiento({
    productoId,
    ordenId,
    cantidadSugerida,
}) {
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
    });
}

module.exports = {
    obtenerProductosActivos,
    obtenerLotes,
    obtenerUmbrales,
    buscarOrdenPendiente,
    crearOrden,
    crearAlertaReabastecimiento,
};