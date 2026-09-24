const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Lote = sequelize.define('Lote', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    producto_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'productos', key: 'id' } },
    numero_lote: { type: DataTypes.STRING(60), allowNull: false },
    cantidad_inicial: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    cantidad_actual: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    fecha_ingreso: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    fecha_vencimiento: { type: DataTypes.DATE, allowNull: false },
    fecha_creacion: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'lotes',
    timestamps: false,
    indexes: [
      { fields: ['producto_id'] },
      { fields: ['fecha_vencimiento'] }
    ],
    uniqueKeys: {
      producto_numero: { fields: ['producto_id', 'numero_lote'] }
    }
  });

  return Lote;
};
