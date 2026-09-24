const { Router } = require('express');
const { autenticar } = require('../middleware/authJwt');
const { verificarPermiso } = require('../middleware/permission');
const { listar, obtener, crear, actualizar, eliminar, historial, registrarMovimientoCtrl } = require('../controllers/loteController');
const router = Router();
router.use(autenticar);

/**
 * @openapi
 * /api/lotes:
 *   get:
 *     summary: Listar lotes
 *     tags: [Lotes]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       '200':
 *         description: Lista de lotes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Lote'
 *   post:
 *     summary: Crear lote
 *     tags: [Lotes]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Lote'
 *     responses:
 *       '201':
 *         description: Lote creado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Lote'
 * /api/lotes/{id}:
 *   get:
 *     summary: Obtener lote por ID
 *     tags: [Lotes]
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
 *         description: Lote encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Lote'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *   put:
 *     summary: Actualizar lote
 *     tags: [Lotes]
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
 *             $ref: '#/components/schemas/Lote'
 *     responses:
 *       '200':
 *         description: Lote actualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Lote'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *   delete:
 *     summary: Eliminar lote
 *     tags: [Lotes]
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
 *         description: Lote eliminado
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 * /api/lotes/{id}/historial:
 *   get:
 *     summary: Obtener historial de movimientos de un lote
 *     tags: [Lotes]
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
 *         description: Historial de movimientos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/MovimientoInventario'
 * /api/lotes/{id}/registrar-movimiento:
 *   post:
 *     summary: Registrar movimiento de inventario
 *     tags: [Lotes]
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
 *             required: [tipo, cantidad]
 *             properties:
 *               tipo:
 *                 type: string
 *                 enum: [ingreso, salida, ajuste]
 *               cantidad:
 *                 type: number
 *                 format: decimal
 *               precio_unitario:
 *                 type: number
 *                 format: decimal
 *               motivo:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Movimiento registrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MovimientoInventario'
 */
router.get('/', verificarPermiso('gestionar_inventario'), listar);
router.get('/:id', verificarPermiso('gestionar_inventario'), obtener);
router.post('/', verificarPermiso('gestionar_inventario'), crear);
router.put('/:id', verificarPermiso('gestionar_inventario'), actualizar);
router.delete('/:id', verificarPermiso('gestionar_inventario'), eliminar);
router.get('/:id/historial', verificarPermiso('gestionar_inventario'), historial);
router.post('/:id/registrar-movimiento', verificarPermiso('gestionar_inventario'), registrarMovimientoCtrl);
module.exports = router;
