const { Router } = require('express');
const { autenticar } = require('../middleware/authJwt');
const { verificarPermiso } = require('../middleware/permission');
const { body } = require('express-validator');
const { listarPorProducto, vigente, crear } = require('../controllers/PrecioController');

const router = Router();
router.use(autenticar);

const handleValidation = (req, res, next) => {
  const errors = require('express-validator').validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Datos inválidos', details: errors.array() });
  return next();
};

/**
 * @openapi
 * /api/productos/{producto_id}/precios:
 *   get:
 *     summary: Listar histórico de precios de un producto
 *     tags: [Precio]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: producto_id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Lista de precios
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Precio'
 *   post:
 *     summary: Registrar un nuevo precio (historial)
 *     tags: [Precio]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [precioLista]
 *             properties:
 *               precioLista:
 *                 type: number
 *                 format: decimal
 *                 minimum: 0
 *               precioDescuento:
 *                 type: number
 *                 format: decimal
 *                 minimum: 0
 *               vigente_desde:
 *                 type: string
 *                 format: date
 *     responses:
 *       '201':
 *         description: Precio registrado
 *       '404':
 *         description: Producto no encontrado
 * /api/productos/{producto_id}/precios/vigente:
 *   get:
 *     summary: Obtener el precio vigente de un producto
 *     tags: [Precio]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: producto_id
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       '200':
 *         description: Precio vigente
 *       '404':
 *         description: No hay precio vigente
 */
router.get('/:producto_id/precios', verificarPermiso('gestionar_productos'), listarPorProducto);
router.get('/:producto_id/precios/vigente', verificarPermiso('gestionar_productos'), vigente);
router.post('/:producto_id/precios', verificarPermiso('gestionar_productos'),
  body('precioLista').isFloat({ min: 0 }),
  body('precioDescuento').optional().isFloat({ min: 0 }),
  handleValidation, crear);

module.exports = router;