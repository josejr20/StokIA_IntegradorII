const { Router } = require('express');
const { query, param, validationResult } = require('express-validator');
const { autenticar } = require('../middleware/authJwt');
const { verificarPermiso } = require('../middleware/permission');
const { listar, obtener, filtros, metodoNoPermitido } = require('../controllers/auditoriaController');

const router = Router();
router.use(autenticar);

// ---------------------------------------------------------------- validaciones (BE-02)

/** 'YYYY-MM-DD' real (rechaza 2025-02-31) o un ISO-8601 con hora. */
const esFechaValida = (valor) => {
  const texto = String(valor).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    const [anio, mes, dia] = texto.split('-').map(Number);
    const f = new Date(Date.UTC(anio, mes - 1, dia));
    return f.getUTCFullYear() === anio && f.getUTCMonth() === mes - 1 && f.getUTCDate() === dia;
  }
  return /^\d{4}-\d{2}-\d{2}T/.test(texto) && !Number.isNaN(new Date(texto).getTime());
};

const validarFecha = (campo) =>
  query(campo).optional({ values: 'falsy' }).custom(esFechaValida)
    .withMessage(`${campo} debe tener formato AAAA-MM-DD y ser una fecha real`);

const validarListado = [
  query(['usuario_id', 'usuario']).optional({ values: 'falsy' }).isInt({ min: 1 })
    .withMessage('El usuario debe ser un id numérico').toInt(),
  query(['entidad', 'accion']).optional({ values: 'falsy' }).isString().isLength({ max: 100 }).trim(),
  validarFecha('fecha_desde'),
  validarFecha('fecha_hasta'),
  query('fecha_hasta').optional({ values: 'falsy' }).custom((hasta, { req }) => {
    const desde = req.query.fecha_desde;
    // Comparación lexicográfica válida para AAAA-MM-DD; para ISO completos también funciona.
    return !desde || !esFechaValida(desde) || !esFechaValida(hasta) || String(desde) <= String(hasta);
  }).withMessage('fecha_desde no puede ser posterior a fecha_hasta'),
  query('orden').optional({ values: 'falsy' }).isIn(['asc', 'desc', 'ASC', 'DESC'])
    .withMessage('orden debe ser asc o desc'),
  query('page').optional().isInt({ min: 1 }).withMessage('page debe ser un entero >= 1').toInt(),
  query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('limit debe estar entre 1 y 200').toInt(),
];

const validarId = [param('id').isInt({ min: 1, max: 9007199254740991 }).withMessage('El id debe ser numérico')];

const responderErrores = (req, res, next) => {
  const errores = validationResult(req);
  if (errores.isEmpty()) return next();
  return res.status(400).json({ error: 'Datos inválidos', details: errores.array() });
};

// ---------------------------------------------------------------- documentación

/**
 * @openapi
 * /api/auditoria:
 *   get:
 *     summary: Consultar el historial de auditoría (más reciente primero por defecto)
 *     description: Requiere el permiso `ver_auditoria`. Los registros son de solo lectura.
 *     tags: [Auditoria]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - { name: usuario_id, in: query, schema: { type: integer }, description: "Filtrar por usuario (alias: usuario)" }
 *       - { name: entidad, in: query, schema: { type: string }, description: "Filtrar por entidad (productos, lotes, ...)" }
 *       - { name: accion, in: query, schema: { type: string }, description: "Filtrar por acción (crear_productos, ...)" }
 *       - { name: fecha_desde, in: query, schema: { type: string, format: date }, description: "Desde (inclusive, hora de Perú)" }
 *       - { name: fecha_hasta, in: query, schema: { type: string, format: date }, description: "Hasta (inclusive, hora de Perú)" }
 *       - { name: orden, in: query, schema: { type: string, enum: [asc, desc], default: desc } }
 *       - { name: page, in: query, schema: { type: integer, default: 1 } }
 *       - { name: limit, in: query, schema: { type: integer, default: 50, maximum: 200 } }
 *     responses:
 *       '200':
 *         description: Página de registros ordenados cronológicamente
 *       '400':
 *         description: Filtros inválidos
 *       '401':
 *         description: Sin sesión
 *       '403':
 *         description: Sin el permiso ver_auditoria
 * /api/auditoria/filtros:
 *   get:
 *     summary: Usuarios y entidades presentes en la auditoría (para los filtros)
 *     tags: [Auditoria]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       '200':
 *         description: Opciones de filtro
 * /api/auditoria/{id}:
 *   get:
 *     summary: Obtener un registro de auditoría
 *     tags: [Auditoria]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: integer } }
 *     responses:
 *       '200':
 *         description: Registro encontrado
 *       '404':
 *         description: No existe
 */

// ---------------------------------------------------------------- rutas

// Solo lectura. Todo lo que no sea GET responde 405 (TC-06 / SEC-01).
router.route('/')
  .get(verificarPermiso('ver_auditoria'), validarListado, responderErrores, listar)
  .all(metodoNoPermitido);

// '/filtros' va antes de '/:id' para que no se interprete como un id.
router.route('/filtros')
  .get(verificarPermiso('ver_auditoria'), filtros)
  .all(metodoNoPermitido);

router.route('/:id')
  .get(verificarPermiso('ver_auditoria'), validarId, responderErrores, obtener)
  .all(metodoNoPermitido);

module.exports = router;
