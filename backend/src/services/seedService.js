const { v4: uuidv4 } = require('uuid');
const { Rol } = require('../models');
const logger = require('../utils/logger');

const seedInicial = async () => {
  const permisos = [
    'gestionar_productos', 'gestionar_inventario', 'gestionar_ventas',
    'configurar_umbrales', 'gestionar_reabastecimiento', 'ver_alertas',
    'generar_reportes', 'ver_kpis', 'gestionar_usuarios', 'gestionar_roles',
    'ver_auditoria'
  ];

  const roles = {
    'Administrador': permisos,
    'Encargado de Inventario': [
      'gestionar_productos', 'gestionar_inventario', 'gestionar_ventas',
      'configurar_umbrales', 'gestionar_reabastecimiento', 'ver_alertas'
    ],
    'Encargado de Almacén': ['gestionar_productos', 'gestionar_inventario', 'ver_alertas'],
    'Jefe de Ventas': ['ver_alertas', 'generar_reportes', 'ver_kpis']
  };

  for (const codigo of permisos) {
    await Rol.findOrCreate({ where: { codigo }, defaults: { descripcion: codigo } });
  }

  const permisoRecords = {};
  for (const codigo of permisos) {
    const [permiso] = await Rol.findOrCreate({ where: { codigo } });
    permisoRecords[codigo] = permiso;
  }

  for (const [nombreRol, codigos] of Object.entries(roles)) {
    const [rol] = await Rol.findOrCreate({ where: { nombre: nombreRol } });
    for (const codigo of codigos) {
      await rol.addPermiso(permisoRecords[codigo]);
    }
  }

  logger.info('Roles y permisos iniciales creados');
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
