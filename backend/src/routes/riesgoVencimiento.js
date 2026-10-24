const { Router } = require('express');
const { autenticar } = require('../middleware/authJwt');
const { verificarPermiso } = require('../middleware/permission');
const { listar } = require('../controllers/riesgoVencimientoController');
const router = Router();
router.use(autenticar);

/**
 * @openapi
 * /api/riesgo-vencimiento:
 *   get:
 *     summary: Riesgo de vencimiento de los lotes con stock (según stock, demanda estimada y fecha de vencimiento)
 *     tags: [Predicciones]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: producto_ids
 *         in: query
 *         schema:
 *           type: string
 *           example: '2,3,5'
 *         description: Ids de producto separados por coma (opcional; por defecto todos los que tienen stock)
 *       - name: nivel
 *         in: query
 *         schema:
 *           type: string
 *           enum: [alto, medio, bajo, datos_insuficientes]
 *         description: Filtra la lista de productos por nivel de riesgo
 *     responses:
 *       '200':
 *         description: Resumen por nivel y detalle por producto y lote, con los factores de cada clasificación
 *       '400':
 *         description: Parámetros inválidos
 */
router.get('/', verificarPermiso('ver_alertas'), listar);

module.exports = router;
