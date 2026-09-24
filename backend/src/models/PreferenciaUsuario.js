const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PreferenciaUsuario = sequelize.define('PreferenciaUsuario', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    usuario_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'usuarios', key: 'id' } },
    clave: { type: DataTypes.STRING(80), allowNull: false },
    valor: { type: DataTypes.JSONB, allowNull: false },
    fecha_actualizacion: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'preferencias_usuario',
    timestamps: false,
    uniqueKeys: {
      usuario_clave: { fields: ['usuario_id', 'clave'] }
    }
  });

  return PreferenciaUsuario;
};
