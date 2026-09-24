const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Categoria = sequelize.define('Categoria', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nombre: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    descripcion: { type: DataTypes.TEXT, allowNull: true },
    vida_util_dias: { type: DataTypes.INTEGER, allowNull: true }
  }, {
    tableName: 'categorias',
    timestamps: false,
    defaultScope: { order: [['nombre', 'ASC']] }
  });

  return Categoria;
};
