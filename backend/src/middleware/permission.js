const { Usuario } = require('../models');
const logger = require('../utils/logger');

const verificarPermiso = (permisoRequerido) => {
  const permisosValidos = Array.isArray(permisoRequerido) ? permisoRequerido : [permisoRequerido];
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
      const tienePermiso = permisos.some(p => permisosValidos.includes(p.codigo));

      if (!tienePermiso) {
        logger.warn(`Usuario ${usuario.email} sin permiso: ${permisosValidos.join(', ')}`);
        return res.status(403).json({ error: 'No tienes permiso para esta acción' });
      }

      next();
    } catch (error) {
      logger.error('Error verificando permiso:', error.message);
      return res.status(500).json({ error: 'Error al verificar permisos' });
    }
  };
};

const verificarAdministrador = async (req, res, next) => {
  try {
    const usuario = await Usuario.findByPk(req.user.id, {
      include: [{ model: Usuario.sequelize.models.Rol, as: 'rol' }]
    });

    if (!usuario || usuario.rol?.nombre?.toLocaleLowerCase() !== 'administrador') {
      return res.status(403).json({ error: 'Solo un administrador puede gestionar usuarios' });
    }

    return next();
  } catch (error) {
    logger.error('Error verificando el rol de administrador:', error.message);
    return res.status(500).json({ error: 'Error al verificar permisos' });
  }
};

module.exports = { verificarPermiso, verificarAdministrador };
