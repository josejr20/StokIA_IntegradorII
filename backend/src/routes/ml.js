const { Router } = require('express');
const { autenticar } = require('../middleware/authJwt');
const { verificarPermiso } = require('../middleware/permission');
const { listar, entrenar, activar, evaluar } = require('../controllers/mlController');
const router = Router();
router.use(autenticar);

// Entrenar, activar y evaluar son acciones del administrador del sistema. Hoy el único permiso exclusivo
// del rol Administrador es este; si el equipo crea un permiso propio para ML, se cambia solo aquí.
const PERMISO_ADMINISTRADOR = 'gestionar_usuarios';

/**
 * @openapi
 * /api/ml/modelos:
 *   get:
 *     summary: Estado del modelo de demanda (versión activa, historial de versiones y avisos)
 *     tags: [Machine Learning]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       '200':
 *         description: Modelo activo, versiones con sus métricas (MAE, RMSE, RMSE relativo) y avisos para el administrador
 */
router.get('/modelos', verificarPermiso('ver_kpis'), listar);

/**
 * @openapi
 * /api/ml/entrenamientos:
 *   post:
 *     summary: Entrenar (o reentrenar) el modelo con el historial de ventas y registrar una nueva versión
 *     tags: [Machine Learning]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       '201':
 *         description: Versión creada con sus métricas; queda activa si cumple el umbral, o requiere revisión
 *       '409':
 *         description: Ya hay un entrenamiento en curso
 *       '422':
 *         description: No hay datos históricos suficientes para entrenar
 */
router.post('/entrenamientos', verificarPermiso(PERMISO_ADMINISTRADOR), entrenar);

/**
 * @openapi
 * /api/ml/modelos/{id}/activar:
 *   post:
 *     summary: Poner una versión del modelo como activa
 *     tags: [Machine Learning]
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
 *         description: Versión activada
 *       '404':
 *         description: La versión no existe
 */
router.post('/modelos/:id/activar', verificarPermiso(PERMISO_ADMINISTRADOR), activar);

/**
 * @openapi
 * /api/ml/modelo-activo/evaluacion:
 *   post:
 *     summary: Medir de nuevo el desempeño del modelo activo con las ventas recientes
 *     tags: [Machine Learning]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       '200':
 *         description: Métricas recientes y, si caen por debajo del umbral aceptable, un aviso
 *       '422':
 *         description: No hay datos suficientes para evaluar
 */
router.post('/modelo-activo/evaluacion', verificarPermiso(PERMISO_ADMINISTRADOR), evaluar);

module.exports = router;
