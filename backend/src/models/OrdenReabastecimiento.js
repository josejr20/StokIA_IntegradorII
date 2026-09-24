const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const OrdenReabastecimiento = sequelize.define('OrdenReabastecimiento', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    producto_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'productos', key: 'id' } },
    cantidad_sugerida: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    cantidad_aprobada: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
    estado: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'pendiente', validate: { isIn: [['pendiente', 'aprobada', 'rechazada', 'completada']] } },
    generado_por: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'automatico', validate: { isIn: [['automatico', 'manual']] } },
    usuario_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'usuarios', key: 'id' } },
    fecha_creacion: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    fecha_actualizacion: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'ordenes_reabastecimiento',
    timestamps: false,
    indexes: [
      { fields: ['estado'] }
    ]
  });

  return OrdenReabastecimiento;
};
