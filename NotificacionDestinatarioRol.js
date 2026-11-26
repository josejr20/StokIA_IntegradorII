const { DataTypes } = require('sequelize');

/**
 * US-32 / HU-165: roles que reciben por correo las alertas críticas de cada tipo.
 * Una fila por (rol, tipo de alerta); `activo` permite desactivarla sin borrarla.
 */
module.exports = (sequelize) => {
  const NotificacionDestinatarioRol = sequelize.define('NotificacionDestinatarioRol', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    rol_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'roles', key: 'id' } },
    tipo_alerta: {
      type: DataTypes.STRING(30),
      allowNull: false,
      validate: { isIn: [['riesgo_vencimiento', 'bajo_stock']] }
    },
    activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    fecha_actualizacion: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'notificacion_destinatarios_rol',
    timestamps: false,
    indexes: [{ unique: true, fields: ['rol_id', 'tipo_alerta'] }]
  });

  return NotificacionDestinatarioRol;
};
