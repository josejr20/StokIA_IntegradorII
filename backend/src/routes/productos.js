const { Router } = require('express');
const { autenticar } = require('../middleware/authJwt');
const { verificarPermiso } = require('../middleware/permission');
const { uploadProducto } = require('../middleware/uploadProducto');
const { listar, obtener, crear, actualizar, desactivar, activar, ingreso } = require('../controllers/productoController');
const router = Router();
router.use(autenticar);

/**
 * @openapi
 * /api/productos:
 *   get:
 *     summary: Listar productos
 *     tags: [Productos]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: categoria_id
 *         in: query
 *         schema:
 *           type: integer
 *         description: Filtrar por categoría
 *       - name: activo
 *         in: query
 *         schema:
 *           type: boolean
 *         description: Filtrar por estado activo
 *     responses:
 *       '200':
 *         description: Lista de productos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Producto'
 *   post:
 *     summary: Crear producto
 *     tags: [Productos]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Producto'
 *     responses:
 *       '201':
 *         description: Producto creado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Producto'
 * /api/productos/{id}:
 *   get:
 *     summary: Obtener producto por ID
 *     tags: [Productos]
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
 *         description: Producto encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Producto'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *   put:
 *     summary: Actualizar producto
 *     tags: [Productos]
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
 *             $ref: '#/components/schemas/Producto'
 *     responses:
 *       '200':
 *         description: Producto actualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Producto'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 * /api/productos/{id}/desactivar:
 *   patch:
 *     summary: Desactivar producto
 *     tags: [Productos]
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
 *               motivo_detalle:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Producto desactivado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Producto'
 * /api/productos/{id}/activar:
 *   patch:
 *     summary: Activar producto
 *     tags: [Productos]
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
 *         description: Producto activado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Producto'
 * /api/productos/{id}/ingreso:
 *   post:
 *     summary: Registrar ingreso de producto
 *     tags: [Productos]
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
 *             required: [lote_id, cantidad, precio_unitario]
 *             properties:
 *               lote_id:
 *                 type: integer
 *               cantidad:
 *                 type: number
 *                 format: decimal
 *               precio_unitario:
 *                 type: number
 *                 format: decimal
 *               fecha_ingreso:
 *                 type: string
 *                 format: date
 *     responses:
 *       '200':
 *         description: Ingreso registrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Producto'
 */
router.get('/', verificarPermiso('gestionar_productos'), listar);
router.get('/:id', verificarPermiso('gestionar_productos'), obtener);
router.post('/', verificarPermiso('gestionar_productos'), uploadProducto.single('imagen'), crear);
router.put('/:id', verificarPermiso('gestionar_productos'), uploadProducto.single('imagen'), actualizar);
router.patch('/:id/desactivar', verificarPermiso('gestionar_productos'), desactivar);
router.patch('/:id/activar', verificarPermiso('gestionar_productos'), activar);
router.post('/:id/ingreso', verificarPermiso('gestionar_productos'), ingreso);
module.exports = router;
