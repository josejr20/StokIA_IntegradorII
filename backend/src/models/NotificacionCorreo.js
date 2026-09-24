const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const NotificacionCorreo = sequelize.define('NotificacionCorreo', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    alerta_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'alertas', key: 'id' } },
    destinatario: { type: DataTypes.STRING(254), allowNull: false },
    estado: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'pendiente', validate: { isIn: [['pendiente', 'enviado', 'fallido']] } },
    proveedor: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'brevo' },
    fecha_envio: { type: DataTypes.DATE, allowNull: true }
  }, {
    tableName: 'notificaciones_correo',
    timestamps: false
  });

  return NotificacionCorreo;
};
