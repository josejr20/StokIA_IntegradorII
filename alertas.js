const { Router } = require('express');
const { autenticar } = require('../middleware/authJwt');
const { verificarPermiso, verificarAdministrador } = require('../middleware/permission');
const { listar, obtener, crear, actualizar, marcarVista, atender, notificar, sincronizarML } = require('../controllers/alertaController');
const { vistaPrevia: vistaPreviaAnomaliasLocales, registrar: registrarAnomaliasLocales } = require('../controllers/anomaliasLocalController');
const { listar: listarVencimiento } = require('../controllers/alertaVencimientoController');
const router = Router();
router.use(autenticar);

/**
 * @openapi
 * /api/alertas:
 *   get:
 *     summary: Listar alertas
 *     tags: [Alertas]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: estado
 *         in: query
 *         schema:
 *           type: string
 *         description: Filtrar por estado
 *       - name: tipo
 *         in: query
 *         schema:
 *           type: string
 *         description: Filtrar por tipo
 *     responses:
 *       '200':
 *         description: Lista de alertas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Alerta'
 *   post:
 *     summary: Crear alerta
 *     tags: [Alertas]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Alerta'
 *     responses:
 *       '201':
 *         description: Alerta creada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Alerta'
 * /api/alertas/vencimiento:
 *   get:
 *     summary: Alertas activas de riesgo alto de vencimiento (dashboard, US-29)
 *     description: Recalcula el riesgo con los datos actuales y devuelve producto, lote y motivo de cada alerta.
 *     tags: [Alertas]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       '200':
 *         description: '{ alertas, total, hay_alertas, sincronizado, actualizado_en }'
 * /api/alertas/{id}:
 *   get:
 *     summary: Obtener alerta por ID
 *     tags: [Alertas]
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
 *         description: Alerta encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Alerta'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *   put:
 *     summary: Actualizar alerta
 *     tags: [Alertas]
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
 *             $ref: '#/components/schemas/Alerta'
 *     responses:
 *       '200':
 *         description: Alerta actualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Alerta'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 * /api/alertas/{id}/marcar-vista:
 *   post:
 *     summary: Marcar alerta como vista
 *     tags: [Alertas]
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
 *         description: Alerta marcada como vista
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Alerta'
 * /api/alertas/{id}/atender:
 *   post:
 *     summary: Atender alerta
 *     tags: [Alertas]
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
 *         description: Alerta atendida
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Alerta'
 * /api/alertas/{id}/notificar:
 *   post:
 *     summary: Enviar notificaciÃ³n de alerta
 *     tags: [Alertas]
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
 *         description: NotificaciÃ³n enviada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Alerta'
 * /api/alertas/sincronizar-ml:
 *   post:
 *     summary: Sincronizar alertas con Machine Learning
 *     tags: [Alertas]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       '200':
 *         description: SincronizaciÃ³n completada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 procesado:
 *                   type: integer
 *                   example: 10
 *                 con_error:
 *                   type: integer
 *                   example: 1
 */
router.get('/anomalias-local/vista-previa', verificarPermiso('ver_alertas'), vistaPreviaAnomaliasLocales);
router.post('/anomalias-local/evaluar', verificarAdministrador, registrarAnomaliasLocales);
// US-29: debe ir antes de '/:id' para que 'vencimiento' no se lea como un id.
router.get('/vencimiento', verificarPermiso('ver_alertas'), listarVencimiento);
router.get('/', verificarPermiso('ver_alertas'), listar);
router.get('/:id', verificarPermiso('ver_alertas'), obtener);
router.post('/', verificarPermiso('ver_alertas'), crear);
router.put('/:id', verificarPermiso('ver_alertas'), actualizar);
router.post('/:id/marcar-vista', verificarPermiso('ver_alertas'), marcarVista);
router.post('/:id/atender', verificarPermiso('ver_alertas'), atender);
router.post('/:id/notificar', verificarPermiso('ver_alertas'), notificar);
router.post('/sincronizar-ml', verificarPermiso('ver_alertas'), sincronizarML);
module.exports = router;
