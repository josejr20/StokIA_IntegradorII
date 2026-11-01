const { DataTypes, Op } = require('sequelize');

module.exports = (sequelize) => {
  const ImportacionVenta = sequelize.define('ImportacionVenta', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    usuario_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'usuarios', key: 'id' } },
    nombre_archivo: { type: DataTypes.STRING(255), allowNull: false },
    hash_archivo: { type: DataTypes.STRING(64), allowNull: true },
    filas_procesadas: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    filas_con_error: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    detalle_errores: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    estado: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'procesando', validate: { isIn: [['procesando', 'completado', 'fallido']] } },
    fecha: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'importaciones_ventas',
    timestamps: false,
    indexes: [{ unique: true, fields: ['hash_archivo'], where: { hash_archivo: { [Op.ne]: null } } }],
  });

  return ImportacionVenta;
};
