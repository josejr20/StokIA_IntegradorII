const { Auditoria } = require('../models');
const config = require('../config');
const logger = require('../utils/logger');

const registrarAuditoria = async (req, res, next) => {
  try {
    if (req.user && req.user.id) {
      const { Usuario } = require('../models');
      const usuario = await Usuario.findByPk(req.user.id);
      if (usuario) {
        req._auditoriaUsuario = usuario;
      }
    }
    next();
  } catch (error) {
    logger.warn('Error al preparar auditoria:', error.message);
    next();
  }
};

const crearAuditoria = async (usuarioId, accion, entidad, entidadId, detalle) => {
  try {
    if (!usuarioId) return;
    await Auditoria.create({
      usuario_id: usuarioId,
      accion,
      entidad,
      entidad_id: entidadId || null,
      detalle: detalle || null
    });
  } catch (error) {
    logger.error('Error al crear auditoría:', error.message);
  }
};

const generarAccionesAuditoria = () => {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (req.method === 'POST' && req.path.includes('/api/') && req.user) {
        const resource = req.path.split('/api/')[1]?.split('/')[0];
        const accionMap = {
          usuarios: 'crear_usuario',
          roles: 'crear_rol',
          permisos: 'crear_permiso',
          categorias: 'crear_categoria',
          productos: 'crear_producto',
          lotes: 'crear_lote',
          movimientos: 'crear_movimiento',
          ventas: 'crear_venta',
          alertas: 'crear_alerta',
          reportes: 'generar_reporte',
          umbrales: 'crear_umbral',
          ordenes: 'crear_orden',
          preferencias: 'crear_preferencia'
        };
        const accion = accionMap[resource] || `${req.method}_${resource}`;
        const entidadId = body && body.id ? body.id : (req.params.id ? parseInt(req.params.id) : null);
        crearAuditoria(req.user.id, accion, resource, entidadId, { body: req.body });
      }
      return originalJson(body);
    };
    next();
  };
};

module.exports = { registrarAuditoria, crearAuditoria, generarAccionesAuditoria };
