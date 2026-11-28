const { Router } = require('express');
const { autenticar } = require('../middleware/authJwt');

const {
  listar,
  obtener,
  crear,
  actualizar,
  eliminar
} = require('../controllers/preferenciaController');

const router = Router();

router.use(autenticar);

/**
 * @openapi
 * tags:
 *   - name: Preferencias
 *     description: Configuración de preferencias personales del usuario.
 *
 * components:
 *   schemas:
 *     PreferenciaUsuario:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         usuario_id:
 *           type: integer
 *         clave:
 *           type: string
 *           example: dashboard_kpis
 *         valor:
 *           type: object
 *           additionalProperties: true
 *         fecha_actualizacion:
 *           type: string
 *           format: date-time
 *
 * /api/preferencias:
 *   get:
 *     summary: Listar preferencias del usuario autenticado
 *     description: Obtiene todas las preferencias asociadas al usuario de la sesión.
 *     tags: [Preferencias]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       '200':
 *         description: Preferencias obtenidas correctamente.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PreferenciaUsuario'
 *       '401':
 *         description: Usuario no autenticado.
 *
 *   post:
 *     summary: Crear o guardar una preferencia
 *     description: Crea una preferencia o actualiza la existente para el usuario autenticado.
 *     tags: [Preferencias]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - clave
 *               - valor
 *             properties:
 *               clave:
 *                 type: string
 *                 example: dashboard_kpis
 *               valor:
 *                 type: object
 *                 example:
 *                   indicadores:
 *                     - productos_activos
 *                     - alertas_activas
 *     responses:
 *       '200':
 *         description: Preferencia guardada correctamente.
 *       '400':
 *         description: Datos de preferencia inválidos.
 *       '401':
 *         description: Usuario no autenticado.
 *
 * /api/preferencias/{clave}:
 *   get:
 *     summary: Obtener una preferencia específica
 *     description: Busca una preferencia por su clave y por el usuario autenticado.
 *     tags: [Preferencias]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: clave
 *         in: path
 *         required: true
 *         description: Clave de la preferencia.
 *         schema:
 *           type: string
 *           example: dashboard_kpis
 *     responses:
 *       '200':
 *         description: Preferencia encontrada.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/PreferenciaUsuario'
 *       '401':
 *         description: Usuario no autenticado.
 *       '404':
 *         description: Preferencia no encontrada.
 *
 *   put:
 *     summary: Actualizar una preferencia
 *     description: Modifica el valor de una preferencia existente del usuario autenticado.
 *     tags: [Preferencias]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: clave
 *         in: path
 *         required: true
 *         description: Clave de la preferencia que se actualizará.
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - valor
 *             properties:
 *               valor:
 *                 type: object
 *                 example:
 *                   indicadores:
 *                     - ventas_mes_actual
 *                     - ordenes_pendientes
 *     responses:
 *       '200':
 *         description: Preferencia actualizada correctamente.
 *       '400':
 *         description: Datos inválidos.
 *       '401':
 *         description: Usuario no autenticado.
 *       '404':
 *         description: Preferencia no encontrada.
 *
 *   delete:
 *     summary: Eliminar una preferencia
 *     description: Elimina una preferencia del usuario autenticado para restablecer su configuración predeterminada.
 *     tags: [Preferencias]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: clave
 *         in: path
 *         required: true
 *         description: Clave de la preferencia que se eliminará.
 *         schema:
 *           type: string
 *           example: dashboard_kpis
 *     responses:
 *       '200':
 *         description: Preferencia eliminada correctamente.
 *       '401':
 *         description: Usuario no autenticado.
 *       '404':
 *         description: Preferencia no encontrada.
 */

router.get('/', listar);

router.get('/:clave', obtener);

router.post('/', crear);

router.put('/:clave', actualizar);

router.delete('/:clave', eliminar);

module.exports = router;