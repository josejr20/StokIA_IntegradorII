const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CatalogoMarca = sequelize.define('CatalogoMarca', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nombre: { type: DataTypes.STRING(100), allowNull: false, unique: true }
  }, {
    tableName: 'catalogo_marcas',
    timestamps: false,
    defaultScope: { order: [['nombre', 'ASC']] }
  });

  return CatalogoMarca;
};
