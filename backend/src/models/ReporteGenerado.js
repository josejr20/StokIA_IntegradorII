const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ReporteGenerado = sequelize.define('ReporteGenerado', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    usuario_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'usuarios', key: 'id' } },
    tipo: { type: DataTypes.STRING(50), allowNull: false },
    formato: { type: DataTypes.STRING(10), allowNull: false, validate: { isIn: [['excel', 'pdf']] } },
    parametros: { type: DataTypes.JSONB, allowNull: true },
    ruta_archivo: { type: DataTypes.STRING(255), allowNull: true },
    fecha_generacion: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'reportes_generados',
    timestamps: false
  });

  return ReporteGenerado;
};
