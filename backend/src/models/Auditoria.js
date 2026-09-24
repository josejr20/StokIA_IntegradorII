const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Auditoria = sequelize.define('Auditoria', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    usuario_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'usuarios', key: 'id' } },
    accion: { type: DataTypes.STRING(100), allowNull: false },
    entidad: { type: DataTypes.STRING(80), allowNull: false },
    entidad_id: { type: DataTypes.INTEGER, allowNull: true },
    detalle: { type: DataTypes.JSONB, allowNull: true },
    fecha: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'auditoria',
    timestamps: false,
    indexes: [
      { fields: ['entidad'] },
      { fields: ['usuario_id'] },
      { fields: ['fecha'] }
    ]
  });

  return Auditoria;
};
