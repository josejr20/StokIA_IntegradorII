const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Alerta = sequelize.define('Alerta', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    tipo: { type: DataTypes.STRING(30), allowNull: false, validate: { isIn: [['riesgo_vencimiento', 'bajo_stock', 'anomalia']] } },
    producto_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'productos', key: 'id' } },
    lote_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'lotes', key: 'id' } },
    mensaje: { type: DataTypes.TEXT, allowNull: false },
    severidad: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'media', validate: { isIn: [['baja', 'media', 'alta', 'critica']] } },
    datos_origen: { type: DataTypes.JSONB, allowNull: true },
    estado: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'nueva', validate: { isIn: [['nueva', 'vista', 'atendida', 'descartada']] } },
    fecha_creacion: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    fecha_atendida: { type: DataTypes.DATE, allowNull: true }
  }, {
    tableName: 'alertas',
    timestamps: false,
    indexes: [
      { fields: ['producto_id'] },
      { fields: ['estado'] },
      { fields: ['severidad'] }
    ]
  });

  return Alerta;
};
