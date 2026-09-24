const { Router } = require('express');
const { autenticar } = require('../middleware/authJwt');
const { verificarPermiso } = require('../middleware/permission');
const { listar, obtener, crear, actualizar, eliminar } = require('../controllers/permisoController');
const router = Router();
router.use(autenticar);

/**
 * @openapi
 * /api/permisos:
 *   get:
 *     summary: Listar permisos
 *     tags: [Permisos]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       '200':
 *         description: Lista de permisos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Permiso'
 *   post:
 *     summary: Crear permiso
 *     tags: [Permisos]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [codigo]
 *             properties:
 *               codigo:
 *                 type: string
 *               descripcion:
 *                 type: string
 *     responses:
 *       '201':
 *         description: Permiso creado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Permiso'
 * /api/permisos/{id}:
 *   get:
 *     summary: Obtener permiso por ID
 *     tags: [Permisos]
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
 *         description: Permiso encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Permiso'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *   put:
 *     summary: Actualizar permiso
 *     tags: [Permisos]
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
 *             type: object
 *             properties:
 *               codigo:
 *                 type: string
 *               descripcion:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Permiso actualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Permiso'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *   delete:
 *     summary: Eliminar permiso
 *     tags: [Permisos]
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
 *         description: Permiso eliminado
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/', verificarPermiso('gestionar_roles'), listar);
router.get('/:id', verificarPermiso('gestionar_roles'), obtener);
router.post('/', verificarPermiso('gestionar_roles'), crear);
router.put('/:id', verificarPermiso('gestionar_roles'), actualizar);
router.delete('/:id', verificarPermiso('gestionar_roles'), eliminar);
module.exports = router;
