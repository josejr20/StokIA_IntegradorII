const { Router } = require('express');
const { autenticar } = require('../middleware/authJwt');
const { verificarPermiso } = require('../middleware/permission');
const { demanda, historial } = require('../controllers/prediccionController');
const router = Router();
router.use(autenticar);

/**
 * @openapi
 * /api/predicciones/demanda:
 *   get:
 *     summary: Predecir la demanda de uno o varios productos a partir del historial de ventas
 *     tags: [Predicciones]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: producto_ids
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           example: '2,3,5'
 *         description: Ids de producto separados por coma (máximo 10)
 *       - name: horizonte_dias
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 30
 *           default: 7
 *         description: Cantidad de días a predecir
 *     responses:
 *       '200':
 *         description: Un resultado por producto (estado ok, datos_insuficientes o no_encontrado)
 *       '400':
 *         description: Parámetros inválidos
 */
router.get('/demanda', verificarPermiso('ver_kpis'), demanda);

/**
 * @openapi
 * /api/predicciones/historico:
 *   get:
 *     summary: Comparar la predicción de demanda con las ventas reales por producto y periodo
 *     tags: [Predicciones]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - { name: producto_id, in: query, schema: { type: integer } }
 *       - { name: desde, in: query, schema: { type: string, format: date } }
 *       - { name: hasta, in: query, schema: { type: string, format: date } }
 *       - { name: periodo_dias, in: query, schema: { type: integer, enum: [1, 7, 14, 30], default: 7 } }
 *     responses:
 *       '200':
 *         description: Comparación y resumen de precisión
 *       '400':
 *         description: Filtros inválidos
 *       '404':
 *         description: El producto no existe
 */
router.get('/historico', verificarPermiso('ver_kpis'), historial);

module.exports = router;
