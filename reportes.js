const { Router } = require('express');
const { autenticar } = require('../middleware/authJwt');
const { verificarPermiso } = require('../middleware/permission');
const { exportarInventario, kpis, resumenInicio } = require('../controllers/reporteController');
const { kpisGenerales } = require('../controllers/kpiGeneralesController');
const router = Router();
router.use(autenticar);

/**
 * @openapi
 * /api/reportes/inventario:
 *   get:
 *     summary: Exportar reporte de inventario
 *     tags: [Reportes]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: formato
 *         in: query
 *         schema:
 *           type: string
 *           enum: [excel, pdf]
 *         description: Formato de exportación
 *     responses:
 *       '200':
 *         description: Reporte de inventario exportado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ReporteGenerado'
 * /api/reportes/kpis:
 *   get:
 *     summary: Obtener KPIs de inventario
 *     tags: [Reportes]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       '200':
 *         description: KPIs de inventario
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *               total_productos:
 *                 type: integer
 *               total_valorizado:
 *                 type: number
 *                 format: decimal
 *               alertas_activas:
 *                 type: integer
 * /api/reportes/kpis/generales:
 *   get:
 *     summary: KPIs generales (rotación de inventario y mermas evitadas) por periodo (US-34)
 *     tags: [Reportes]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: periodo
 *         in: query
 *         schema:
 *           type: string
 *           enum: [30d, 90d, 180d, 365d, mes_actual, mes_anterior, personalizado]
 *       - name: desde
 *         in: query
 *         schema: { type: string, format: date }
 *       - name: hasta
 *         in: query
 *         schema: { type: string, format: date }
 *     responses:
 *       '200':
 *         description: Indicadores del periodo; suficiente=false cuando faltan datos históricos
 *       '400':
 *         description: Periodo no válido
 * /api/reportes/inicio:
 *   get:
 *     summary: Obtener resumen de inicio
 *     tags: [Reportes]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       '200':
 *         description: Resumen de inicio
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total_productos:
 *                   type: integer
 *                 total_lotes:
 *                   type: integer
 *                 total_ventas:
 *                   type: integer
 *                 total_alertas:
 *                   type: integer
 */
router.get('/inventario', verificarPermiso('generar_reportes'), exportarInventario);
router.get('/kpis', verificarPermiso('ver_kpis'), kpis);
router.get('/kpis/generales', verificarPermiso('ver_kpis'), kpisGenerales);
router.get('/inicio', verificarPermiso('generar_reportes'), resumenInicio);
module.exports = router;
