const { Usuario } = require('../models');
const logger = require('../utils/logger');

const verificarPermiso = (permisoRequerido) => {
  return async (req, res, next) => {
    try {
      const usuario = await Usuario.findByPk(req.user.id, {
        include: [{ model: Usuario.sequelize.models.Rol, as: 'rol' }]
      });

      if (!usuario) {
        return res.status(403).json({ error: 'Usuario no encontrado' });
      }

      const rol = usuario.rol;
      if (!rol) {
        return res.status(403).json({ error: 'Usuario sin rol asignado' });
      }

      if (usuario.is_staff || usuario.is_superuser) {
        return next();
      }

      const permisos = await rol.getPermisos();
      const tienePermiso = permisos.some(p => p.codigo === permisoRequerido);

      if (!tienePermiso) {
        logger.warn(`Usuario ${usuario.email} sin permiso: ${permisoRequerido}`);
        return res.status(403).json({ error: 'No tienes permiso para esta acción' });
      }

      next();
    } catch (error) {
      logger.error('Error verificando permiso:', error.message);
      return res.status(500).json({ error: 'Error al verificar permisos' });
    }
  };
};

module.exports = { verificarPermiso };
