const { Router } = require('express');
const { autenticar } = require('../middleware/authJwt');
const { verificarPermiso } = require('../middleware/permission');
const { demanda } = require('../controllers/prediccionController');
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

module.exports = router;
