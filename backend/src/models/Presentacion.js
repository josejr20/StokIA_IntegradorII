const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Presentacion = sequelize.define('Presentacion', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nombre: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    descripcion: { type: DataTypes.TEXT, allowNull: true }
  }, {
    tableName: 'presentaciones',
    timestamps: false,
    defaultScope: { order: [['nombre', 'ASC']] }
  });

  return Presentacion;
};
