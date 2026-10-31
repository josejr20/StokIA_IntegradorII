const { Permiso, Rol, RolPermiso, UnidadMedida, TipoEnvase } = require('../models');
const logger = require('../utils/logger');

const seedInicial = async () => {
  const permisos = [
    'gestionar_productos', 'gestionar_inventario', 'gestionar_ventas',
    'configurar_umbrales', 'gestionar_reabastecimiento', 'ver_alertas',
    'generar_reportes', 'ver_kpis', 'gestionar_usuarios', 'gestionar_roles',
    'ver_auditoria', 'importar_ventas'
  ];

  const roles = {
    'Administrador': permisos,
    'Encargado de Inventario': [
      'gestionar_productos', 'gestionar_inventario', 'gestionar_ventas',
      'configurar_umbrales', 'gestionar_reabastecimiento', 'ver_alertas'
    ],
    'Encargado de Almacén': ['gestionar_inventario', 'ver_alertas'],
    'Jefe de Ventas': ['ver_alertas', 'generar_reportes', 'ver_kpis']
  };

  const permisosCount = await Permiso.count();
  if (permisosCount === 0) {
    logger.info('Creando permisos y roles iniciales...');
    for (const codigo of permisos) {
      await Permiso.create({ codigo, descripcion: codigo });
    }

    for (const [nombre, codigos] of Object.entries(roles)) {
      const rol = await Rol.create({ nombre });
      for (const codigo of codigos) {
        const permiso = await Permiso.findOne({ where: { codigo } });
        await RolPermiso.create({ rol_id: rol.id, permiso_id: permiso.id });
      }
    }
    logger.info('Roles y permisos iniciales creados');
  } else {
    logger.info('Roles y permisos ya existen');
  }

  const [permisoImportarVentas] = await Permiso.findOrCreate({
    where: { codigo: 'importar_ventas' },
    defaults: { codigo: 'importar_ventas', descripcion: 'importar_ventas' },
  });
  const rolAdministrador = await Rol.findOne({ where: { nombre: 'Administrador' } });
  if (rolAdministrador) {
    await RolPermiso.findOrCreate({
      where: { rol_id: rolAdministrador.id, permiso_id: permisoImportarVentas.id },
      defaults: { rol_id: rolAdministrador.id, permiso_id: permisoImportarVentas.id },
    });
  }

  const unidadesMedida = [
    { nombre: 'UNIDAD', abreviatura: 'UND' },
    { nombre: 'GRAMO', abreviatura: 'GR' },
    { nombre: 'KILOGRAMO', abreviatura: 'KG' },
    { nombre: 'LITRO', abreviatura: 'LT' },
    { nombre: 'MILILITRO', abreviatura: 'ML' },
    { nombre: 'ONZA', abreviatura: 'OZ' },
    { nombre: 'HOJA', abreviatura: 'HOJA' },
    { nombre: 'CAJA', abreviatura: 'CJ' },
    { nombre: 'PAQUETE', abreviatura: 'PAQ' },
    { nombre: 'SOBRE', abreviatura: 'SOB' },
    { nombre: 'BOLSA', abreviatura: 'BLS' },
    { nombre: 'DISPLAY', abreviatura: 'DISPLAY' },
    { nombre: 'METRO', abreviatura: 'M' },
    { nombre: 'CENTIMETRO', abreviatura: 'CM' },
    { nombre: 'YARDAS', abreviatura: 'YD' },
    { nombre: 'LITRO', abreviatura: 'L' },
    { nombre: 'GALON', abreviatura: 'GAL' },
  ];
  for (const u of unidadesMedida) {
    await UnidadMedida.findOrCreate({ where: { nombre: u.nombre }, defaults: u });
  }
  logger.info('Unidades de medida sembradas');

  const tiposEnvase = [
    'UNIDAD', 'SOBRE', 'BOLSA', 'SACHET', 'CAJA', 'PAQUETE', 'DISPLAY',
    'FAR', 'FARD', 'SACO', 'PLANCHA', 'BAGAZO', 'TIRA', 'HOJA', 'ROLLO',
    'CJ', 'BLS', 'PAQ', 'GRANEL', 'KIT', 'ENVASE', 'BOTELLA', 'VASO',
    'TAPA', 'TAPER', 'BOWL', 'CONO', 'CUCHARA', 'TENEDOR', 'PLATO',
    'BANDEJA', 'ESTUCHE', 'SANGUCHERA', 'TALONERA', 'AJICERO', 'CHEQUERA',
    'CINTA', 'CELOFAN', 'CRISTAL', 'SERVILLENA', 'PAPEL', 'MONDADIENTE',
    'CONTENEDOR', 'LIGA', 'ESPONJA', 'SORBETE', 'DARNEL', 'ENVASE BISAGRA',
    'PLATOS TECKNOPOR', 'PISO DE TORTA', 'CHAROLA', 'BOMBAONERA',
    'TAPER-BOLWS', 'ENV CIRC', 'ENVASE CLAMSHELL', 'ENVASE DELI',
    'ENVASE HELADO', 'TAPA DOMO', 'ENVASE BISAGRA/BASE DUPLO/DOMO',
    'ESPECERIAS-AJINOMOTO', 'SIBARITA', 'CONDIMENTOS', 'VASOS - BOT',
  ];
  for (const nombre of tiposEnvase) {
    await TipoEnvase.findOrCreate({ where: { nombre }, defaults: { nombre, activo: true } });
  }
  logger.info('Tipos de envase sembrados');
};

const crearRol = async (nombre, descripcion) => {
  const [rol, created] = await Rol.create({ nombre, descripcion });
  return { rol, created };
};

const asignarPermisoRol = async (rolId, permisoId) => {
  const { Rol, Permiso, RolPermiso } = require('../models');
  const rol = await Rol.findByPk(rolId);
  const permiso = await Permiso.findByPk(permisoId);
  if (!rol || !permiso) throw new Error('Rol o permiso no encontrado');
  await rol.addPermiso(permiso);
  return true;
};

module.exports = { seedInicial, crearRol, asignarPermisoRol };
