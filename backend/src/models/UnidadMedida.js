const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const UnidadMedida = sequelize.define('UnidadMedida', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nombre: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    abreviatura: { type: DataTypes.STRING(10), allowNull: false }
  }, {
    tableName: 'unidades_medida',
    timestamps: false,
    defaultScope: { order: [['nombre', 'ASC']] }
  });

  return UnidadMedida;
};
