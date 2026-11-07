const { Router } = require('express');
const { autenticar } = require('../middleware/authJwt');
const { verificarPermiso } = require('../middleware/permission');
const { listar, entrenar, activar, evaluar, metricas, comparar } = require('../controllers/mlController');
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
 * /api/ml/metricas:
 *   get:
 *     summary: Métricas de desempeño (MAE, RMSE) de cada versión del modelo, con comparación contra la anterior
 *     tags: [Machine Learning]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       '200':
 *         description: >
 *           Por versión: mae, rmse, rmse_relativo, calidad (buena | aceptable | requiere_revision), requiere_revision,
 *           interpretacion en lenguaje claro, vs_anterior (mejora | empeora | igual) e historial_evaluaciones.
 */
router.get('/metricas', verificarPermiso('ver_kpis'), metricas);

/**
 * @openapi
 * /api/ml/metricas/comparacion:
 *   get:
 *     summary: Compara el desempeño de dos versiones del modelo
 *     tags: [Machine Learning]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - { in: query, name: base, required: true, schema: { type: integer }, description: Versión de referencia }
 *       - { in: query, name: nueva, required: true, schema: { type: integer }, description: Versión que se compara }
 *     responses:
 *       '200': { description: Diferencia de MAE, RMSE y RMSE relativo, y veredicto (mejora | empeora | igual) }
 *       '400': { description: Versiones inválidas o iguales }
 *       '404': { description: Alguna versión no existe }
 */
router.get('/metricas/comparacion', verificarPermiso('ver_kpis'), comparar);

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
 *         description: >
 *           Versión creada con sus métricas; queda activa si cumple el umbral, o requiere revisión.
 *           Incluye la fecha de inicio/fin y la duración del entrenamiento (`entrenamiento`) y el resumen de
 *           los datos preparados que se usaron (`datos_preparados`).
 *       '409':
 *         description: Ya hay un entrenamiento en curso
 *       '422':
 *         description: >
 *           No hay datos históricos suficientes para entrenar (codigo `datos_insuficientes`). El cuerpo incluye
 *           `detalle` con las filas válidas, el mínimo requerido y la duración del intento. No se crea ninguna versión.
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
