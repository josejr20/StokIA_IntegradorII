const { Router } = require('express');
const { autenticar } = require('../middleware/authJwt');
const { verificarPermiso } = require('../middleware/permission');
const {
  listar,
  obtener,
  crear,
  actualizar,
  historial,
} = require('../controllers/clienteController');

const router = Router();
router.use(autenticar);

/**
 * @openapi
 * /api/clientes:
 *   get:
 *     summary: Listar clientes
 *     tags: [Clientes]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: buscar
 *         in: query
 *         schema:
 *           type: string
 *           description: Busca por nombre o documento
 *       - name: activo
 *         in: query
 *         schema:
 *           type: boolean
 *     responses:
 *       '200':
 *         description: Lista de clientes
 *   post:
 *     summary: Registrar un cliente
 *     tags: [Clientes]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Cliente'
 *     responses:
 *       '201':
 *         description: Cliente registrado
 * /api/clientes/{id}:
 *   get:
 *     summary: Obtener un cliente
 *     tags: [Clientes]
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
 *         description: Cliente encontrado
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *   patch:
 *     summary: Actualizar un cliente (nombre, documento, activo)
 *     tags: [Clientes]
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
 *             $ref: '#/components/schemas/Cliente'
 *     responses:
 *       '200':
 *         description: Cliente actualizado
 * /api/clientes/{id}/historial:
 *   get:
 *     summary: Historial de operaciones de un cliente
 *     tags: [Clientes]
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
 *         description: Operaciones del cliente
 */
router.get('/', verificarPermiso('gestionar_ventas'), listar);
router.post('/', verificarPermiso('gestionar_ventas'), crear);
router.get('/:id/historial', verificarPermiso('gestionar_ventas'), historial);
router.get('/:id', verificarPermiso('gestionar_ventas'), obtener);
router.patch('/:id', verificarPermiso('gestionar_ventas'), actualizar);

module.exports = router;
