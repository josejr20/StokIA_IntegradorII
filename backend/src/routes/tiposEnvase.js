const { Router } = require('express');
const { autenticar } = require('../middleware/authJwt');
const { verificarPermiso } = require('../middleware/permission');
const { listar, obtener, crear, actualizar } = require('../controllers/TipoEnvaseController');
const router = Router();
router.use(autenticar);

/**
 * @openapi
 * /api/tipos-envase:
 *   get:
 *     summary: Listar tipos de envase
 *     tags: [TiposEnvase]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       '200':
 *         description: Lista de tipos de envase
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TipoEnvase'
 *   post:
 *     summary: Crear tipo de envase
 *     tags: [TiposEnvase]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TipoEnvase'
 *     responses:
 *       '201':
 *         description: Tipo de envase creado
 * /api/tipos-envase/{id}:
 *   get:
 *     summary: Obtener tipo de envase por ID
 *     tags: [TiposEnvase]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Tipo de envase encontrado
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *   put:
 *     summary: Actualizar tipo de envase
 *     tags: [TiposEnvase]
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
 *             $ref: '#/components/schemas/TipoEnvase'
 *     responses:
 *       '200':
 *         description: Tipo de envase actualizado
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/', verificarPermiso('gestionar_productos'), listar);
router.get('/:id', verificarPermiso('gestionar_productos'), obtener);
router.post('/', verificarPermiso('gestionar_productos'), crear);
router.put('/:id', verificarPermiso('gestionar_productos'), actualizar);

module.exports = router;