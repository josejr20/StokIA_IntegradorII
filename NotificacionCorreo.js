const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const NotificacionCorreo = sequelize.define('NotificacionCorreo', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    alerta_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'alertas', key: 'id' } },
    destinatario: { type: DataTypes.STRING(254), allowNull: false },
    estado: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'pendiente', validate: { isIn: [['pendiente', 'enviado', 'fallido']] } },
    proveedor: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'smtp' },
    fecha_envio: { type: DataTypes.DATE, allowNull: true },
    // US-32 (HU-166): historial y reintentos. Requiere sql/us32_notificaciones_alertas_criticas.sql
    rol: { type: DataTypes.STRING(50), allowNull: true },
    asunto: { type: DataTypes.STRING(300), allowNull: true },
    intentos: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    ultimo_error: { type: DataTypes.TEXT, allowNull: true },
    proximo_reintento: { type: DataTypes.DATE, allowNull: true },
    fecha_creacion: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'notificaciones_correo',
    timestamps: false
  });

  return NotificacionCorreo;
};
