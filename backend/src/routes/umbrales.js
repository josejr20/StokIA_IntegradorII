const { Router } = require('express');
const { autenticar } = require('../middleware/authJwt');
const { verificarPermiso } = require('../middleware/permission');
const { listar, obtener, crear, actualizar, eliminar } = require('../controllers/umbralController');
const router = Router();
router.use(autenticar);

/**
 * @openapi
 * /api/umbrales:
 *   get:
 *     summary: Listar umbrales de configuración
 *     tags: [Umbrales]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: tipo
 *         in: query
 *         schema:
 *           type: string
 *         description: Filtrar por tipo
 *     responses:
 *       '200':
 *         description: Lista de umbrales
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/UmbralConfiguracion'
 *   post:
 *     summary: Crear umbral de configuración
 *     tags: [Umbrales]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UmbralConfiguracion'
 *     responses:
 *       '201':
 *         description: Umbral creado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UmbralConfiguracion'
 * /api/umbrales/{id}:
 *   get:
 *     summary: Obtener umbral por ID
 *     tags: [Umbrales]
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
 *         description: Umbral encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UmbralConfiguracion'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *   put:
 *     summary: Actualizar umbral
 *     tags: [Umbrales]
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
 *             $ref: '#/components/schemas/UmbralConfiguracion'
 *     responses:
 *       '200':
 *         description: Umbral actualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UmbralConfiguracion'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *   delete:
 *     summary: Eliminar umbral
 *     tags: [Umbrales]
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
 *         description: Umbral eliminado
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/', verificarPermiso('configurar_umbrales'), listar);
router.get('/:id', verificarPermiso('configurar_umbrales'), obtener);
router.post('/', verificarPermiso('configurar_umbrales'), crear);
router.put('/:id', verificarPermiso('configurar_umbrales'), actualizar);
router.delete('/:id', verificarPermiso('configurar_umbrales'), eliminar);
module.exports = router;
