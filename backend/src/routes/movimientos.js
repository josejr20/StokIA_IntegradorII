const { Router } = require('express');
const { autenticar } = require('../middleware/authJwt');
const { verificarPermiso } = require('../middleware/permission');
const { listar, obtener } = require('../controllers/movimientoController');
const router = Router();
router.use(autenticar);

/**
 * @openapi
 * /api/movimientos:
 *   get:
 *     summary: Listar movimientos de inventario
 *     tags: [Movimientos]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: lote_id
 *         in: query
 *         schema:
 *           type: integer
 *         description: Filtrar por lote
 *       - name: tipo
 *         in: query
 *         schema:
 *           type: string
 *         description: Filtrar por tipo
 *     responses:
 *       '200':
 *         description: Lista de movimientos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/MovimientoInventario'
 * /api/movimientos/{id}:
 *   get:
 *     summary: Obtener movimiento por ID
 *     tags: [Movimientos]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Movimiento encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MovimientoInventario'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/', verificarPermiso('gestionar_inventario'), listar);
router.get('/:id', verificarPermiso('gestionar_inventario'), obtener);
module.exports = router;
