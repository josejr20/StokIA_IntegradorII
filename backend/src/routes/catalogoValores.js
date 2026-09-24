const { Router } = require('express');
const { autenticar } = require('../middleware/authJwt');
const { verificarPermiso } = require('../middleware/permission');
const { listar, obtener, crear, actualizar, eliminar } = require('../controllers/catalogoValorController');
const router = Router();
router.use(autenticar);

/**
 * @openapi
 * /api/catalogo-valores:
 *   get:
 *     summary: Listar valores de catálogo
 *     tags: [CatalogoValores]
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
 *         description: Lista de valores
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/CatalogoValor'
 *   post:
 *     summary: Crear valor de catálogo
 *     tags: [CatalogoValores]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CatalogoValor'
 *     responses:
 *       '201':
 *         description: Valor creado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CatalogoValor'
 * /api/catalogo-valores/{id}:
 *   get:
 *     summary: Obtener valor por ID
 *     tags: [CatalogoValores]
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
 *         description: Valor encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CatalogoValor'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *   put:
 *     summary: Actualizar valor
 *     tags: [CatalogoValores]
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
 *             $ref: '#/components/schemas/CatalogoValor'
 *     responses:
 *       '200':
 *         description: Valor actualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CatalogoValor'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *   delete:
 *     summary: Eliminar valor
 *     tags: [CatalogoValores]
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
 *         description: Valor eliminado
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/', verificarPermiso('gestionar_productos'), listar);
router.get('/:id', verificarPermiso('gestionar_productos'), obtener);
router.post('/', verificarPermiso('gestionar_productos'), crear);
router.put('/:id', verificarPermiso('gestionar_productos'), actualizar);
router.delete('/:id', verificarPermiso('gestionar_productos'), eliminar);
module.exports = router;
