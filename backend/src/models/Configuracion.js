const { DataTypes } = require('sequelize');

/**
 * Configuración general de la tienda como pares clave/valor.
 * Hoy solo guarda `impuesto_porcentaje`: el impuesto que se
 * aplica a las ventas. En 0 significa "no configurado", y el
 * comprobante no muestra línea de impuesto.
 */
module.exports = (sequelize) => {
  const Configuracion = sequelize.define('Configuracion', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    clave: { type: DataTypes.STRING(80), allowNull: false, unique: true },
    valor: { type: DataTypes.STRING(500), allowNull: false },
    fecha_actualizacion: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'configuraciones',
    timestamps: false
  });

  return Configuracion;
};
