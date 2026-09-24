const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Permiso = sequelize.define('Permiso', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    codigo: { type: DataTypes.STRING(80), allowNull: false, unique: true },
    descripcion: { type: DataTypes.TEXT, allowNull: true }
  }, {
    tableName: 'permisos',
    timestamps: false
  });

  return Permiso;
};
