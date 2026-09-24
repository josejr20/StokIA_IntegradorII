const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Producto = sequelize.define('Producto', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    codigo: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    nombre: { type: DataTypes.STRING(200), allowNull: false },
    descripcion: { type: DataTypes.TEXT, allowNull: true },
    imagen: { type: DataTypes.STRING(255), allowNull: true },
    precio_venta: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    caracteristicas: { type: DataTypes.JSONB, defaultValue: {} },
    es_bonificacion: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    motivo_desactivacion: { type: DataTypes.STRING(20), allowNull: true },
    motivo_desactivacion_detalle: { type: DataTypes.STRING(255), allowNull: true },
    fecha_desactivacion: { type: DataTypes.DATE, allowNull: true },
    fecha_creacion: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    fecha_actualizacion: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    contenido_valor: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    categoria_paquete_id: { type: DataTypes.INTEGER, allowNull: true },
    contenido_paquete_cantidad: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    contenido_paquete_envase_id: { type: DataTypes.INTEGER, allowNull: true },
  }, {
    tableName: 'productos',
    timestamps: false,
    indexes: [
      { fields: ['codigo'] },
      { fields: ['categoria_id'] },
      { fields: ['activo'] }
    ]
  });

  return Producto;
};
