const { Router } = require('express');
const { autenticar } = require('../middleware/authJwt');
const { verificarPermiso } = require('../middleware/permission');
const { listar, obtener, crear, resumen, importar } = require('../controllers/ventaController');
const { recibirArchivoVenta } = require('../middleware/uploadVentas');
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
 * /api/ventas/resumen:
 *   get:
 *     summary: Resumen de ventas (totales)
 *     tags: [Ventas]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: producto
 *         in: query
 *         schema:
 *           type: integer
 *         description: Filtrar por producto
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
 *       - name: incluir_ajustes
 *         in: query
 *         schema:
 *           type: boolean
 *         description: "Incluir devoluciones y anulaciones en totales (default: false)"
 *     responses:
 *       '200':
 *         description: Totales del periodo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     total_cantidad:
 *                       type: number
 *                     total_monto:
 *                       type: number
 *                     origenes_incluidos:
 *                       type: array
 *                       items:
 *                         type: string
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
 * /api/ventas/importar:
 *   post:
 *     summary: Importar historial de ventas desde CSV o Excel
 *     description: Solo el Administrador puede importar. Las filas históricas no alteran el stock actual.
 *     tags: [Ventas]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [archivo]
 *             properties:
 *               archivo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       '200':
 *         description: Resultado de filas procesadas y rechazadas
 *       '400':
 *         description: Archivo inválido o columnas requeridas faltantes
 *       '403':
 *         description: Permiso denegado
 *       '409':
 *         description: El archivo ya fue importado
 */
router.get('/', verificarPermiso('gestionar_ventas'), listar);
router.get('/resumen', verificarPermiso('gestionar_ventas'), resumen);
router.post('/importar', verificarPermiso('importar_ventas'), recibirArchivoVenta, importar);
router.get('/:id', verificarPermiso('gestionar_ventas'), obtener);
router.post('/', verificarPermiso('gestionar_ventas'), crear);
module.exports = router;
