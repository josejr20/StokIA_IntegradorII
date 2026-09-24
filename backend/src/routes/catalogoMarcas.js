const { Router } = require('express');
const { autenticar } = require('../middleware/authJwt');
const { verificarPermiso } = require('../middleware/permission');
const { listar, obtener, crear, actualizar, eliminar } = require('../controllers/catalogoMarcaController');
const router = Router();
router.use(autenticar);

/**
 * @openapi
 * /api/catalogo-marcas:
 *   get:
 *     summary: Listar marcas
 *     tags: [CatalogoMarcas]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       '200':
 *         description: Lista de marcas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/CatalogoMarca'
 *   post:
 *     summary: Crear marca
 *     tags: [CatalogoMarcas]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CatalogoMarca'
 *     responses:
 *       '201':
 *         description: Marca creada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CatalogoMarca'
 * /api/catalogo-marcas/{id}:
 *   get:
 *     summary: Obtener marca por ID
 *     tags: [CatalogoMarcas]
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
 *         description: Marca encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CatalogoMarca'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *   put:
 *     summary: Actualizar marca
 *     tags: [CatalogoMarcas]
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
 *             $ref: '#/components/schemas/CatalogoMarca'
 *     responses:
 *       '200':
 *         description: Marca actualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CatalogoMarca'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *   delete:
 *     summary: Eliminar marca
 *     tags: [CatalogoMarcas]
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
 *         description: Marca eliminada
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/', verificarPermiso('gestionar_productos'), listar);
router.get('/:id', verificarPermiso('gestionar_productos'), obtener);
router.post('/', verificarPermiso('gestionar_productos'), crear);
router.put('/:id', verificarPermiso('gestionar_productos'), actualizar);
router.delete('/:id', verificarPermiso('gestionar_productos'), eliminar);
module.exports = router;
