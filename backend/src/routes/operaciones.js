const { Router } = require('express');
const { autenticar } = require('../middleware/authJwt');
const { verificarPermiso } = require('../middleware/permission');
const {
  listar,
  obtener,
  crear,
  obtenerComprobante,
  anular,
  verImpuesto,
  configurarImpuesto,
} = require('../controllers/operacionController');

const router = Router();
router.use(autenticar);

/**
 * @openapi
 * /api/operaciones:
 *   get:
 *     summary: Listar operaciones (ventas, devoluciones y ajustes)
 *     tags: [Operaciones]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: tipo
 *         in: query
 *         schema:
 *           type: string
 *           enum: [venta, devolucion, ajuste]
 *       - name: cliente_id
 *         in: query
 *         schema:
 *           type: integer
 *       - name: fecha_desde
 *         in: query
 *         schema:
 *           type: string
 *           format: date
 *       - name: fecha_hasta
 *         in: query
 *         schema:
 *           type: string
 *           format: date
 *       - name: buscar
 *         in: query
 *         schema:
 *           type: string
 *           description: Busca por número de operación
 *     responses:
 *       '200':
 *         description: Lista de operaciones
 *   post:
 *     summary: Registrar una operación (venta, devolución o ajuste)
 *     tags: [Operaciones]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Operacion'
 *     responses:
 *       '201':
 *         description: Operación registrada con su número único
 *       '400':
 *         $ref: '#/components/responses/BadRequestError'
 * /api/operaciones/configuracion/impuesto:
 *   get:
 *     summary: Obtener el porcentaje de impuesto configurado
 *     tags: [Operaciones]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       '200':
 *         description: Porcentaje de impuesto (0 = no configurado)
 *   put:
 *     summary: Configurar el porcentaje de impuesto de las ventas
 *     tags: [Operaciones]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               impuesto_porcentaje:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *     responses:
 *       '200':
 *         description: Porcentaje guardado
 * /api/operaciones/{id}:
 *   get:
 *     summary: Obtener una operación con sus detalles
 *     tags: [Operaciones]
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
 *         description: Operación encontrada
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 * /api/operaciones/{id}/comprobante:
 *   get:
 *     summary: Obtener el comprobante de una operación
 *     tags: [Operaciones]
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
 *         description: Comprobante con el snapshot de la venta
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 * /api/operaciones/{id}/anular:
 *   post:
 *     summary: Anular una venta y revertir el inventario
 *     tags: [Operaciones]
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
 *         description: Operación anulada
 *       '400':
 *         $ref: '#/components/responses/BadRequestError'
 */
router.get('/', verificarPermiso('gestionar_ventas'), listar);
router.get('/configuracion/impuesto', verificarPermiso('gestionar_ventas'), verImpuesto);
router.put('/configuracion/impuesto', verificarPermiso('gestionar_ventas'), configurarImpuesto);
router.get('/:id', verificarPermiso('gestionar_ventas'), obtener);
router.get('/:id/comprobante', verificarPermiso('gestionar_ventas'), obtenerComprobante);
router.post('/:id/anular', verificarPermiso('gestionar_ventas'), anular);
router.post('/', verificarPermiso('gestionar_ventas'), crear);

module.exports = router;
