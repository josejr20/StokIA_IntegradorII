const { Router } = require('express');
const { autenticar } = require('../middleware/authJwt');
const { verificarPermiso, exigirAdministrador } = require('../middleware/permission');
const {
  obtenerConfiguracion,
  guardarConfiguracion,
  historial,
  reintentar,
} = require('../controllers/notificacionController');

const router = Router();
router.use(autenticar);

const soloAdministrador = exigirAdministrador(
  'Solo un administrador puede gestionar las notificaciones por correo',
);

/**
 * @openapi
 * /api/notificaciones/configuracion:
 *   get:
 *     summary: Roles que reciben por correo las alertas críticas (solo administrador)
 *     tags: [Notificaciones]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       '200':
 *         description: Roles del sistema y, por tipo de alerta, si reciben el correo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tipos:
 *                   type: array
 *                   items: { type: string, enum: [riesgo_vencimiento, bajo_stock] }
 *                 roles_por_defecto:
 *                   type: array
 *                   items: { type: string }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       rol_id: { type: integer, example: 3 }
 *                       rol: { type: string, example: Encargado de Almacén }
 *                       riesgo_vencimiento: { type: boolean }
 *                       bajo_stock: { type: boolean }
 *   put:
 *     summary: Configurar los roles destinatarios de las alertas críticas (solo administrador)
 *     tags: [Notificaciones]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [destinatarios]
 *             properties:
 *               destinatarios:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [rol_id]
 *                   properties:
 *                     rol_id: { type: integer, example: 3 }
 *                     riesgo_vencimiento: { type: boolean, example: true }
 *                     bajo_stock: { type: boolean, example: false }
 *     responses:
 *       '200':
 *         description: Configuración guardada (devuelve la configuración vigente)
 *       '400':
 *         description: Datos inválidos
 *       '404':
 *         description: El rol no existe
 * /api/notificaciones/historial:
 *   get:
 *     summary: Historial de notificaciones por correo
 *     tags: [Notificaciones]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - { name: estado, in: query, schema: { type: string, enum: [pendiente, enviado, fallido] } }
 *       - { name: alerta_id, in: query, schema: { type: integer } }
 *       - { name: destinatario, in: query, schema: { type: string } }
 *       - { name: desde, in: query, schema: { type: string, format: date-time } }
 *       - { name: hasta, in: query, schema: { type: string, format: date-time } }
 *       - { name: pagina, in: query, schema: { type: integer, default: 1 } }
 *       - { name: limite, in: query, schema: { type: integer, default: 20, maximum: 100 } }
 *     responses:
 *       '200':
 *         description: Página del historial (más recientes primero)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/NotificacionCorreo'
 *                 total: { type: integer }
 *                 pagina: { type: integer }
 *                 limite: { type: integer }
 * /api/notificaciones/reintentos:
 *   post:
 *     summary: Reintentar ahora los envíos fallidos pendientes (solo administrador)
 *     tags: [Notificaciones]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       '200':
 *         description: Resumen del reintento (revisados, enviados, fallidos, cancelados, omitidos)
 */
router.get('/configuracion', soloAdministrador, obtenerConfiguracion);
router.put('/configuracion', soloAdministrador, guardarConfiguracion);
router.get('/historial', verificarPermiso('ver_alertas'), historial);
router.post('/reintentos', soloAdministrador, reintentar);

module.exports = router;
