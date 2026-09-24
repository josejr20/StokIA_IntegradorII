const { Router } = require('express');
const { autenticar } = require('../middleware/authJwt');
const { verificarPermiso } = require('../middleware/permission');
const { listar, obtener } = require('../controllers/auditoriaController');
const router = Router();
router.use(autenticar);

/**
 * @openapi
 * /api/auditoria:
 *   get:
 *     summary: Listar registros de auditoría
 *     tags: [Auditoria]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: entidad
 *         in: query
 *         schema:
 *           type: string
 *         description: Filtrar por entidad
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
 *         description: Lista de registros de auditoría
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Auditoria'
 * /api/auditoria/{id}:
 *   get:
 *     summary: Obtener registro de auditoría por ID
 *     tags: [Auditoria]
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
 *         description: Registro de auditoría encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Auditoria'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/', verificarPermiso('ver_auditoria'), listar);
router.get('/:id', verificarPermiso('ver_auditoria'), obtener);
module.exports = router;
