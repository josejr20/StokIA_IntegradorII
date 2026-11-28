
'use strict';

const { Router } = require('express');

const { autenticar } = require('../middleware/authJwt');
const { verificarPermiso } = require('../middleware/permission');

const {
  exportarInventario,
  kpis,
  resumenInicio
} = require('../controllers/reporteController');

const {
  exportarReporte
} = require('../controllers/reporteExportacionController');

const router = Router();

// Todas las rutas requieren autenticación.
router.use(autenticar);

/**
 * EXPORTACIÓN EXISTENTE DE INVENTARIO
 *
 * Conservamos esta ruta para no afectar
 * las funciones anteriores de StockIA.
 */
router.get(
  '/inventario',
  verificarPermiso('generar_reportes'),
  exportarInventario
);

/**
 * INDICADORES DEL DASHBOARD
 *
 * Permite consultar los indicadores
 * operativos del inventario.
 */
router.get(
  '/kpis',
  verificarPermiso('ver_kpis'),
  kpis
);

/**
 * RESUMEN DE INICIO
 *
 * Devuelve la información resumida
 * utilizada por el sistema.
 */
router.get(
  '/inicio',
  verificarPermiso('generar_reportes'),
  resumenInicio
);

/**
 * US-33 / HU-169
 *
 * EXPORTAR REPORTE GENERAL
 *
 * Permite generar archivos PDF o Excel
 * con información de:
 *
 * - Inventario
 * - Predicciones de demanda
 * - Alertas vigentes
 *
 * Parámetros:
 *
 * formato: pdf | excel
 * dias: 7 | 14 | 30
 *
 * Ejemplos:
 *
 * GET /api/reportes/exportar?formato=pdf&dias=7
 *
 * GET /api/reportes/exportar?formato=excel&dias=30
 */
router.get(
  '/exportar',
  verificarPermiso('generar_reportes'),
  exportarReporte
);

module.exports = router;
