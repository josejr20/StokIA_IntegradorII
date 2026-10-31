'use strict';

const repositorio = require('../services/reabastecimientoRepositorio');
const { evaluarProducto } = require('../services/reabastecimientoAutomaticoService');
const mlClient = require('../ml_client');

/**
 * HU-133 / US-26
 * Evalúa el reabastecimiento sin crear órdenes.
 */
async function simular(req, res, next) {
    try {
        const productoId = Number(req.body?.producto_id);

        if (!Number.isInteger(productoId) || productoId <= 0) {
            return res.status(400).json({
                error: 'Debe proporcionar un producto_id válido',
            });
        }

        const resultado = await evaluarProducto({
            productoId,
            repositorio,
            obtenerPrediccion: (id, horizonte) =>
                mlClient.obtenerPrediccion(id, horizonte),
        });

        return res.json({ data: resultado });
    } catch (error) {
        return next(error);
    }
}

module.exports = { simular };