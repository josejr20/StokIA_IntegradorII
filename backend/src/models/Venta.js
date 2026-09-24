const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Venta = sequelize.define('Venta', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    producto_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'productos', key: 'id' } },
    lote_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'lotes', key: 'id' } },
    cantidad: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    precio_unitario: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    fecha_venta: { type: DataTypes.DATE, allowNull: false },
    origen: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'manual', validate: { isIn: [['manual', 'importado']] } },
    usuario_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'usuarios', key: 'id' } },
    fecha_creacion: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'ventas',
    timestamps: false,
    indexes: [
      { fields: ['producto_id'] },
      { fields: ['fecha_venta'] }
    ]
  });

  return Venta;
};
