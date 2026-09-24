const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ProductoPresentacion = sequelize.define('ProductoPresentacion', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    producto_id: { type: DataTypes.INTEGER, allowNull: false },
    nivel: { type: DataTypes.SMALLINT, allowNull: false, validate: { min: 1 } },
    envase_id: { type: DataTypes.INTEGER, allowNull: false },
    cantidad: { type: DataTypes.DECIMAL(10, 2), allowNull: false, validate: { min: 0.01 } }
  }, {
    tableName: 'producto_presentacion',
    timestamps: false,
    indexes: [
      { fields: ['producto_id'] },
      { fields: ['envase_id'] },
      { fields: ['producto_id', 'nivel'], unique: true }
    ]
  });

  return ProductoPresentacion;
};