const { Router } = require('express');
const { autenticar } = require('../middleware/authJwt');
const { verificarPermiso } = require('../middleware/permission');
const { listar, obtener, crear } = require('../controllers/ventaController');
const router = Router();
router.use(autenticar);

/**
 * @openapi
 * /api/ventas:
 *   get:
 *     summary: Listar ventas
 *     tags: [Ventas]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: fecha_desde
 *         in: query
 *         schema:
 *           type: string
 *           format: date
 *         description: Filtrar desde fecha
 *       - name: fecha_hasta
 *         in: query
 *         schema:
 *           type: string
 *           format: date
 *         description: Filtrar hasta fecha
 *     responses:
 *       '200':
 *         description: Lista de ventas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Venta'
 *   post:
 *     summary: Registrar venta
 *     tags: [Ventas]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Venta'
 *     responses:
 *       '201':
 *         description: Venta registrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Venta'
 * /api/ventas/{id}:
 *   get:
 *     summary: Obtener venta por ID
 *     tags: [Ventas]
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
 *         description: Venta encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Venta'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/', verificarPermiso('gestionar_ventas'), listar);
router.get('/:id', verificarPermiso('gestionar_ventas'), obtener);
router.post('/', verificarPermiso('gestionar_ventas'), crear);
module.exports = router;
