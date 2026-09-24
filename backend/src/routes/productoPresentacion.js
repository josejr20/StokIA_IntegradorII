const { Router } = require('express');
const { autenticar } = require('../middleware/authJwt');
const { verificarPermiso } = require('../middleware/permission');
const { body } = require('express-validator');
const {
  listarPorProducto, crear, actualizar, eliminar,
} = require('../controllers/ProductoPresentacionController');

const router = Router();
router.use(autenticar);

const handleValidation = (req, res, next) => {
  const errors = require('express-validator').validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Datos inválidos', details: errors.array() });
  return next();
};

/**
 * @openapi
 * /api/productos/{producto_id}/presentaciones-niveles:
 *   get:
 *     summary: Listar niveles de empaque de un producto
 *     tags: [ProductoPresentacion]
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
 *         description: Lista de niveles de empaque
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ProductoPresentacion'
 *   post:
 *     summary: Agregar un nivel de empaque a un producto
 *     tags: [ProductoPresentacion]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nivel, envase_id, cantidad]
 *             properties:
 *               nivel:
 *                 type: integer
 *                 minimum: 1
 *               envase_id:
 *                 type: integer
 *               cantidad:
 *                 type: number
 *                 format: decimal
 *                 minimum: 0.01
 *     responses:
 *       '201':
 *         description: Nivel de empaque creado
 *       '404':
 *         description: Producto no encontrado
 *       '409':
 *         description: Ya existe ese nivel de empaque
 * /api/productos-presentaciones/{id}:
 *   put:
 *     summary: Actualizar un nivel de empaque
 *     tags: [ProductoPresentacion]
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
 *               nivel: { type: integer, minimum: 1 }
 *               envase_id: { type: integer }
 *               cantidad: { type: number, format: decimal, minimum: 0.01 }
 *     responses:
 *       '200':
 *         description: Nivel de empaque actualizado
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *   delete:
 *     summary: Eliminar un nivel de empaque
 *     tags: [ProductoPresentacion]
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
 *         description: Nivel de empaque eliminado
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/:producto_id/presentaciones-niveles', verificarPermiso('gestionar_productos'), listarPorProducto);
router.post('/:producto_id/presentaciones-niveles', verificarPermiso('gestionar_productos'),
  body('nivel').isInt({ min: 1 }),
  body('envase_id').isInt(),
  body('cantidad').isFloat({ min: 0.01 }),
  handleValidation, crear);
router.put('/:id', verificarPermiso('gestionar_productos'), actualizar);
router.delete('/:id', verificarPermiso('gestionar_productos'), eliminar);

module.exports = router;