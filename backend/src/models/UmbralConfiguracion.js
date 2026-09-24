const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const UmbralConfiguracion = sequelize.define('UmbralConfiguracion', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    tipo: { type: DataTypes.STRING(30), allowNull: false, validate: { isIn: [['dias_vencimiento', 'stock_minimo']] } },
    producto_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'productos', key: 'id' } },
    valor: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    usuario_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'usuarios', key: 'id' } },
    fecha_actualizacion: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'umbrales_configuracion',
    timestamps: false,
    indexes: [
      { fields: ['tipo'] },
      { fields: ['producto_id'] }
    ],
    uniqueKeys: {
      tipo_producto: { fields: ['tipo', 'producto_id'] }
    }
  });

  return UmbralConfiguracion;
};
