const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const MovimientoInventario = sequelize.define('MovimientoInventario', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    lote_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'lotes', key: 'id' } },
    tipo: { type: DataTypes.STRING(20), allowNull: false, validate: { isIn: [['ingreso', 'salida', 'ajuste']] } },
    origen: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'otro', validate: { isIn: [['compra', 'venta', 'inicial', 'ajuste', 'otro']] } },
    cantidad: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    precio_unitario: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    precio_total: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
    saldo_cantidad: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    saldo_precio_unitario: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
    saldo_valorizado: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    motivo: { type: DataTypes.STRING(200), allowNull: true },
    usuario_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'usuarios', key: 'id' } },
    fecha: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'movimientos_inventario',
    timestamps: false,
    indexes: [
      { fields: ['lote_id'] },
      { fields: ['fecha'] }
    ]
  });

  return MovimientoInventario;
};
