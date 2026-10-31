const { DataTypes } = require('sequelize');

/**
 * Un producto (y su lote, si corresponde) dentro de una operación.
 * Una operación tiene muchos detalles; un producto puede
 * aparecer en muchas operaciones.
 */
module.exports = (sequelize) => {
  const OperacionDetalle = sequelize.define('OperacionDetalle', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    operacion_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: { model: 'operaciones', key: 'id' }
    },
    producto_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'productos', key: 'id' }
    },
    /** Lote principal; una misma línea puede repartirse en varios lotes. */
    lote_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'lotes', key: 'id' }
    },
    cantidad: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    precio_unitario: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    subtotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 }
  }, {
    tableName: 'operacion_detalles',
    timestamps: false,
    indexes: [
      { fields: ['operacion_id'] },
      { fields: ['producto_id'] },
      { fields: ['lote_id'] }
    ]
  });

  return OperacionDetalle;
};
