const { Router } = require('express');
const { autenticar } = require('../middleware/authJwt');
const { verificarPermiso } = require('../middleware/permission');
const { listar, obtener, crear, actualizar, aprobar, rechazar } = require('../controllers/ordenReabastecimientoController');
const router = Router();
router.use(autenticar);

/**
 * @openapi
 * /api/ordenes-reabastecimiento:
 *   get:
 *     summary: Listar órdenes de reabastecimiento
 *     tags: [OrdenesReabastecimiento]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: estado
 *         in: query
 *         schema:
 *           type: string
 *         description: Filtrar por estado
 *     responses:
 *       '200':
 *         description: Lista de órdenes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/OrdenReabastecimiento'
 *   post:
 *     summary: Crear orden de reabastecimiento
 *     tags: [OrdenesReabastecimiento]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OrdenReabastecimiento'
 *     responses:
 *       '201':
 *         description: Orden creada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OrdenReabastecimiento'
 * /api/ordenes-reabastecimiento/{id}:
 *   get:
 *     summary: Obtener orden por ID
 *     tags: [OrdenesReabastecimiento]
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
 *         description: Orden encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OrdenReabastecimiento'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *   put:
 *     summary: Actualizar orden
 *     tags: [OrdenesReabastecimiento]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OrdenReabastecimiento'
 *     responses:
 *       '200':
 *         description: Orden actualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OrdenReabastecimiento'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 * /api/ordenes-reabastecimiento/{id}/aprobar:
 *   post:
 *     summary: Aprobar orden de reabastecimiento
 *     tags: [OrdenesReabastecimiento]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cantidad_aprobada:
 *                 type: number
 *                 format: decimal
 *     responses:
 *       '200':
 *         description: Orden aprobada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OrdenReabastecimiento'
 * /api/ordenes-reabastecimiento/{id}/rechazar:
 *   post:
 *     summary: Rechazar orden de reabastecimiento
 *     tags: [OrdenesReabastecimiento]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               motivo:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Orden rechazada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OrdenReabastecimiento'
 */
router.get('/', verificarPermiso('gestionar_reabastecimiento'), listar);
router.get('/:id', verificarPermiso('gestionar_reabastecimiento'), obtener);
router.post('/', verificarPermiso('gestionar_reabastecimiento'), crear);
router.put('/:id', verificarPermiso('gestionar_reabastecimiento'), actualizar);
router.post('/:id/aprobar', verificarPermiso('gestionar_reabastecimiento'), aprobar);
router.post('/:id/rechazar', verificarPermiso('gestionar_reabastecimiento'), rechazar);
module.exports = router;
