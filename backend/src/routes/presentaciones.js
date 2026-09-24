const { Router } = require('express');
const { autenticar } = require('../middleware/authJwt');
const { verificarPermiso } = require('../middleware/permission');
const { listar, obtener, crear, actualizar, eliminar } = require('../controllers/presentacionController');
const router = Router();
router.use(autenticar);

/**
 * @openapi
 * /api/presentaciones:
 *   get:
 *     summary: Listar presentaciones
 *     tags: [Presentaciones]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       '200':
 *         description: Lista de presentaciones
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Presentacion'
 *   post:
 *     summary: Crear presentación
 *     tags: [Presentaciones]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Presentacion'
 *     responses:
 *       '201':
 *         description: Presentación creada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Presentacion'
 * /api/presentaciones/{id}:
 *   get:
 *     summary: Obtener presentación por ID
 *     tags: [Presentaciones]
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
 *         description: Presentación encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Presentacion'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *   put:
 *     summary: Actualizar presentación
 *     tags: [Presentaciones]
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
 *             $ref: '#/components/schemas/Presentacion'
 *     responses:
 *       '200':
 *         description: Presentación actualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Presentacion'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *   delete:
 *     summary: Eliminar presentación
 *     tags: [Presentaciones]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       '204':
 *         description: Presentación eliminada
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/', verificarPermiso('gestionar_productos'), listar);
router.get('/:id', verificarPermiso('gestionar_productos'), obtener);
router.post('/', verificarPermiso('gestionar_productos'), crear);
router.put('/:id', verificarPermiso('gestionar_productos'), actualizar);
router.delete('/:id', verificarPermiso('gestionar_productos'), eliminar);
module.exports = router;
