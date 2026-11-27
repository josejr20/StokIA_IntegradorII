/**
 * US-36 · Controlador de consulta de auditoría (solo lectura).
 * La lógica vive en auditoriaService; aquí solo se traduce HTTP <-> servicio.
 * Los filtros ya llegan validados por routes/auditoria.js.
 */
const auditoriaService = require('../services/auditoriaService');
const { AuditoriaDto } = require('../dtos/auditoriaDto');

/** GET /api/auditoria — historial paginado, filtrable por usuario/fecha/entidad/acción. */
const listar = async (req, res, next) => {
  try {
    const q = req.query;
    const { rows, meta } = await auditoriaService.listar({
      // `usuario` se acepta como alias de `usuario_id`.
      usuario_id: q.usuario_id ?? q.usuario,
      entidad: q.entidad,
      accion: q.accion,
      fecha_desde: q.fecha_desde,
      fecha_hasta: q.fecha_hasta,
      orden: q.orden,
      page: q.page,
      limit: q.limit,
    });
    res.json({ data: rows.map((fila) => AuditoriaDto.fromModel(fila)), meta });
  } catch (error) {
    next(error);
  }
};

/** GET /api/auditoria/:id */
const obtener = async (req, res, next) => {
  try {
    const registro = await auditoriaService.obtener(req.params.id);
    if (!registro) return res.status(404).json({ error: 'Registro de auditoría no encontrado' });
    return res.json({ data: AuditoriaDto.fromModel(registro) });
  } catch (error) {
    return next(error);
  }
};

/** GET /api/auditoria/filtros — opciones para los desplegables de la pantalla. */
const filtros = async (req, res, next) => {
  try {
    const { usuarios, entidades } = await auditoriaService.filtros();
    res.json({
      data: {
        usuarios: usuarios.map((u) => ({
          id: u.id,
          nombre: [u.nombres, u.apellidos].filter(Boolean).join(' ').trim() || u.email,
          email: u.email,
        })),
        entidades,
      },
    });
  } catch (error) {
    next(error);
  }
};

/** TC-06: cualquier método distinto de GET sobre /auditoria responde 405. */
const metodoNoPermitido = (req, res) => {
  res.set('Allow', 'GET, HEAD, OPTIONS');
  res.status(405).json({ error: 'La auditoría es de solo lectura: no se permite modificar ni eliminar registros' });
};

module.exports = { listar, obtener, filtros, metodoNoPermitido };
