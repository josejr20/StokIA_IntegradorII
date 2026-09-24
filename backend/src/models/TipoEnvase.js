const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const TipoEnvase = sequelize.define('TipoEnvase', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nombre: { type: DataTypes.STRING(40), allowNull: false, unique: true },
    activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    creado_en: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'tipo_envase',
    timestamps: false,
    defaultScope: { order: [['nombre', 'ASC']] }
  });

  return TipoEnvase;
};