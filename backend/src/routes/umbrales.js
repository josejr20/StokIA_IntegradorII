const { Router } = require('express');
const { autenticar } = require('../middleware/authJwt');
const { verificarPermiso } = require('../middleware/permission');
const { listar, obtener, crear, actualizar, eliminar, resumenStockMinimo, guardarMinimoProducto, quitarMinimoProducto, evaluarTodosStockMinimo, obtenerVencimiento, guardarVencimiento, restablecerVencimientoCategoria, riesgoVencimiento, evaluarVencimiento } = require('../controllers/umbralController');
const router = Router();
router.use(autenticar);

/**
 * @openapi
 * /api/umbrales:
 *   get:
 *     summary: Listar umbrales de configuración
 *     tags: [Umbrales]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: tipo
 *         in: query
 *         schema:
 *           type: string
 *         description: Filtrar por tipo
 *     responses:
 *       '200':
 *         description: Lista de umbrales
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/UmbralConfiguracion'
 *   post:
 *     summary: Crear umbral de configuración
 *     tags: [Umbrales]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UmbralConfiguracion'
 *     responses:
 *       '201':
 *         description: Umbral creado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UmbralConfiguracion'
 * /api/umbrales/{id}:
 *   get:
 *     summary: Obtener umbral por ID
 *     tags: [Umbrales]
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
 *         description: Umbral encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UmbralConfiguracion'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *   put:
 *     summary: Actualizar umbral
 *     tags: [Umbrales]
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
 *             $ref: '#/components/schemas/UmbralConfiguracion'
 *     responses:
 *       '200':
 *         description: Umbral actualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UmbralConfiguracion'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *   delete:
 *     summary: Eliminar umbral
 *     tags: [Umbrales]
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
 *         description: Umbral eliminado
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 */
// US-24: registrar estas rutas ANTES de /:id.
// GET consulta, PUT/DELETE guardan o restablecen; POST genera alertas bajo demanda.
router.get('/stock-minimo/resumen', verificarPermiso('configurar_umbrales'), resumenStockMinimo);
router.put('/stock-minimo/productos/:productoId', verificarPermiso('configurar_umbrales'), guardarMinimoProducto);
router.delete('/stock-minimo/productos/:productoId', verificarPermiso('configurar_umbrales'), quitarMinimoProducto);
router.post('/stock-minimo/evaluar', verificarPermiso('configurar_umbrales'), evaluarTodosStockMinimo);

/**
 * @openapi
 * /api/umbrales/vencimiento:
 *   get:
 *     summary: Consultar el umbral general y los umbrales por categoría
 *     tags: [Umbrales]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       '200':
 *         description: Configuración vigente de vencimiento
 *   put:
 *     summary: Definir el umbral general de días de anticipación
 *     tags: [Umbrales]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [dias]
 *             properties:
 *               dias: { type: integer, minimum: 1, maximum: 3650 }
 *     responses:
 *       '200':
 *         description: Umbral guardado con confirmación
 *       '400':
 *         description: Valor inválido
 * /api/umbrales/vencimiento/categorias/{categoriaId}:
 *   put:
 *     summary: Definir el umbral de una categoría
 *     tags: [Umbrales]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - { name: categoriaId, in: path, required: true, schema: { type: integer } }
 *     responses:
 *       '200':
 *         description: Umbral de categoría guardado
 *       '404':
 *         description: Categoría no encontrada
 *   delete:
 *     summary: Restablecer el umbral de una categoría al valor general
 *     tags: [Umbrales]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - { name: categoriaId, in: path, required: true, schema: { type: integer } }
 *     responses:
 *       '200':
 *         description: Umbral de categoría restablecido
 * /api/umbrales/vencimiento/riesgo:
 *   get:
 *     summary: Consultar lotes vencidos o en riesgo
 *     tags: [Umbrales]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       '200':
 *         description: Lotes con el umbral aplicado por categoría
 * /api/umbrales/vencimiento/evaluar:
 *   post:
 *     summary: Recalcular y generar alertas de vencimiento
 *     tags: [Umbrales]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       '200':
 *         description: Alertas creadas, actualizadas y resueltas
 */
router.get('/vencimiento', verificarPermiso('configurar_umbrales'), obtenerVencimiento);
router.put('/vencimiento', verificarPermiso('configurar_umbrales'), guardarVencimiento);
router.get('/vencimiento/riesgo', verificarPermiso('configurar_umbrales'), riesgoVencimiento);
router.post('/vencimiento/evaluar', verificarPermiso('configurar_umbrales'), evaluarVencimiento);
router.put('/vencimiento/categorias/:categoriaId', verificarPermiso('configurar_umbrales'), guardarVencimiento);
router.delete('/vencimiento/categorias/:categoriaId', verificarPermiso('configurar_umbrales'), restablecerVencimientoCategoria);

router.get('/', verificarPermiso('configurar_umbrales'), listar);
router.get('/:id', verificarPermiso('configurar_umbrales'), obtener);
router.post('/', verificarPermiso('configurar_umbrales'), crear);
router.put('/:id', verificarPermiso('configurar_umbrales'), actualizar);
router.delete('/:id', verificarPermiso('configurar_umbrales'), eliminar);
module.exports = router;
