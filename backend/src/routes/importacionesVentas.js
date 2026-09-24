const { Router } = require('express');
const { autenticar } = require('../middleware/authJwt');
const { verificarPermiso } = require('../middleware/permission');
const { listar, obtener } = require('../controllers/importacionVentaController');
const router = Router();
router.use(autenticar);

/**
 * @openapi
 * /api/importaciones-ventas:
 *   get:
 *     summary: Listar importaciones de ventas
 *     tags: [ImportacionesVentas]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       '200':
 *         description: Lista de importaciones
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ImportacionVenta'
 * /api/importaciones-ventas/{id}:
 *   get:
 *     summary: Obtener importación de venta por ID
 *     tags: [ImportacionesVentas]
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
 *         description: Importación encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ImportacionVenta'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/', verificarPermiso('gestionar_ventas'), listar);
router.get('/:id', verificarPermiso('gestionar_ventas'), obtener);
module.exports = router;
