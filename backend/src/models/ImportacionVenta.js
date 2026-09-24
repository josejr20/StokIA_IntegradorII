const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ImportacionVenta = sequelize.define('ImportacionVenta', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    usuario_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'usuarios', key: 'id' } },
    nombre_archivo: { type: DataTypes.STRING(255), allowNull: false },
    filas_procesadas: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    filas_con_error: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    estado: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'procesando', validate: { isIn: [['procesando', 'completado', 'fallido']] } },
    fecha: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'importaciones_ventas',
    timestamps: false
  });

  return ImportacionVenta;
};
