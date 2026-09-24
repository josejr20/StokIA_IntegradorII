const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const TokenRecuperacion = sequelize.define('TokenRecuperacion', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    usuario_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'usuarios', key: 'id' } },
    token: { type: DataTypes.STRING(255), allowNull: true, unique: true },
    code_hash: { type: DataTypes.STRING(255), allowNull: true },
    intentos: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    expira_en: { type: DataTypes.DATE, allowNull: false },
    usado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    fecha_creacion: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'tokens_recuperacion',
    timestamps: false
  });

  return TokenRecuperacion;
};
