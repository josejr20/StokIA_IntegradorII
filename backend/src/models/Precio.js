const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Precio = sequelize.define('Precio', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    producto_id: { type: DataTypes.INTEGER, allowNull: false },
    precioLista: { type: DataTypes.DECIMAL(10, 2), allowNull: false, validate: { min: 0 } },
    precioDescuento: { type: DataTypes.DECIMAL(10, 2), validate: { min: 0 } },
    vigente_desde: { type: DataTypes.DATEONLY, allowNull: false, defaultValue: DataTypes.NOW },
    creado_en: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'precio',
    timestamps: false,
    indexes: [{ fields: ['producto_id'] }]
  });

  return Precio;
};