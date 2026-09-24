const { Router } = require('express');
const { autenticar } = require('../middleware/authJwt');
const { verificarPermiso } = require('../middleware/permission');
const { listar, obtener, crear, actualizar, eliminar } = require('../controllers/unidadMedidaController');
const router = Router();
router.use(autenticar);

/**
 * @openapi
 * /api/unidades-medida:
 *   get:
 *     summary: Listar unidades de medida
 *     tags: [UnidadesMedida]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       '200':
 *         description: Lista de unidades de medida
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/UnidadMedida'
 *   post:
 *     summary: Crear unidad de medida
 *     tags: [UnidadesMedida]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UnidadMedida'
 *     responses:
 *       '201':
 *         description: Unidad de medida creada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnidadMedida'
 * /api/unidades-medida/{id}:
 *   get:
 *     summary: Obtener unidad de medida por ID
 *     tags: [UnidadesMedida]
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
 *         description: Unidad de medida encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnidadMedida'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *   put:
 *     summary: Actualizar unidad de medida
 *     tags: [UnidadesMedida]
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
 *             $ref: '#/components/schemas/UnidadMedida'
 *     responses:
 *       '200':
 *         description: Unidad de medida actualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnidadMedida'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *   delete:
 *     summary: Eliminar unidad de medida
 *     tags: [UnidadesMedida]
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
 *         description: Unidad de medida eliminada
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/', verificarPermiso('gestionar_productos'), listar);
router.get('/:id', verificarPermiso('gestionar_productos'), obtener);
router.post('/', verificarPermiso('gestionar_productos'), crear);
router.put('/:id', verificarPermiso('gestionar_productos'), actualizar);
router.delete('/:id', verificarPermiso('gestionar_productos'), eliminar);
module.exports = router;
