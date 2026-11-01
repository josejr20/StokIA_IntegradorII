const { Router } = require('express');
const { autenticar } = require('../middleware/authJwt');
const { verificarPermiso } = require('../middleware/permission');
const { uploadProducto } = require('../middleware/uploadProducto');
const { listar, obtener, crear, actualizar, importar, desactivar, activar, ingreso } = require('../controllers/productoController');
const { body, validationResult } = require('express-validator');
const router = Router();
router.use(autenticar);

const validarProducto = [
  body('nombre').trim().notEmpty().withMessage('El nombre es obligatorio')
    .isLength({ max: 200 }).withMessage('Máximo 200 caracteres'),
  body('categoria_id').isInt({ min: 1 }).withMessage('La categoría es obligatoria'),
  body('unidad_medida_id').isInt({ min: 1 }).withMessage('La unidad de medida es obligatoria'),
];

const validarProductoActualizar = [
  body('nombre').optional().trim().notEmpty().withMessage('El nombre no puede estar vacío')
    .isLength({ max: 200 }).withMessage('Máximo 200 caracteres'),
  body('categoria_id').optional().isInt({ min: 1 }).withMessage('La categoría debe ser un entero positivo'),
  body('unidad_medida_id').optional().isInt({ min: 1 }).withMessage('La unidad de medida debe ser un entero positivo'),
];

const validarResultado = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Datos inválidos', details: errors.array() });
  next();
};

const validarCodigoNoModificado = async (req, res, next) => {
  if (req.body.codigo !== undefined) {
    const { Producto } = require('../models');
    const producto = await Producto.findByPk(req.params.id);
    if (producto && req.body.codigo !== producto.codigo) {
      return res.status(400).json({ error: 'El código del producto no se puede modificar' });
    }
  }
  next();
};

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
 * /api/productos/importar:
 *   post:
 *     summary: Importar productos desde CSV/Excel
 *     description: >-
 *       Carga masiva todo-o-nada. Recibe las filas ya validadas por el frontend
 *       con los ids de catálogo resueltos. Si alguna fila es inválida no se
 *       inserta nada y se devuelve 400 con el detalle por fila.
 *     tags: [Productos]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productos]
 *             properties:
 *               productos:
 *                 type: array
 *                 maxItems: 500
 *                 items:
 *                   type: object
 *                   required: [nombre, categoria_id, unidad_medida_id, categoria_paquete_id]
 *                   properties:
 *                     fila: { type: integer, description: Número de fila en el archivo, para reportar errores }
 *                     nombre: { type: string, maxLength: 200 }
 *                     categoria_id: { type: integer }
 *                     unidad_medida_id: { type: integer }
 *                     categoria_paquete_id: { type: integer }
 *                     marca_id: { type: integer }
 *                     contenido_valor: { type: number }
 *                     contenido_paquete_cantidad: { type: number }
 *                     contenido_paquete_envase_id: { type: integer }
 *                     precio_venta: { type: string }
 *                     descripcion: { type: string }
 *     responses:
 *       '201':
 *         description: Productos importados
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     creados: { type: integer }
 *                     codigos: { type: array, items: { type: string } }
 *       '400':
 *         description: Ningún producto se importó por datos inválidos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string }
 *                 details:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       fila: { type: integer }
 *                       msg: { type: string }
 */
router.get('/', verificarPermiso(['gestionar_productos', 'gestionar_inventario']), listar);
router.post('/importar', verificarPermiso('gestionar_productos'), importar);
router.get('/:id', verificarPermiso(['gestionar_productos', 'gestionar_inventario']), obtener);
router.post('/', verificarPermiso('gestionar_productos'), uploadProducto.single('imagen'), validarProducto, validarResultado, crear);
router.put('/:id', verificarPermiso('gestionar_productos'), uploadProducto.single('imagen'), validarProductoActualizar, validarResultado, validarCodigoNoModificado, actualizar);
router.patch('/:id/desactivar', verificarPermiso('gestionar_productos'), desactivar);
router.patch('/:id/activar', verificarPermiso('gestionar_productos'), activar);
router.post('/:id/ingreso', verificarPermiso('gestionar_productos'), ingreso);
module.exports = router;
