const { Router } = require('express');
const { autenticar } = require('../middleware/authJwt');
const { verificarPermiso } = require('../middleware/permission');
const { listar, obtener, crear, actualizar, eliminar } = require('../controllers/preferenciaController');
const router = Router();
router.use(autenticar);

/**
 * @openapi
 * /api/preferencias:
 *   get:
 *     summary: Listar preferencias del usuario
 *     tags: [Preferencias]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       '200':
 *         description: Lista de preferencias
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/PreferenciaUsuario'
 *   post:
 *     summary: Crear preferencia
 *     tags: [Preferencias]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [clave, valor]
 *             properties:
 *               clave:
 *                 type: string
 *               valor:
 *                 type: object
 *                 additionalProperties: true
 *     responses:
 *       '201':
 *         description: Preferencia creada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PreferenciaUsuario'
 * /api/preferencias/{clave}:
 *   get:
 *     summary: Obtener preferencia por clave
 *     tags: [Preferencias]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: clave
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Preferencia encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PreferenciaUsuario'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *   put:
 *     summary: Actualizar preferencia
 *     tags: [Preferencias]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: clave
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               valor:
 *                 type: object
 *                 additionalProperties: true
 *     responses:
 *       '200':
 *         description: Preferencia actualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PreferenciaUsuario'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *   delete:
 *     summary: Eliminar preferencia
 *     tags: [Preferencias]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: clave
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '204':
 *         description: Preferencia eliminada
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/', listar);
router.get('/:clave', obtener);
router.post('/', crear);
router.put('/:clave', actualizar);
router.delete('/:clave', eliminar);
module.exports = router;
