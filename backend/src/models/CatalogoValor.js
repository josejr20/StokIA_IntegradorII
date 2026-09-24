const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CatalogoValor = sequelize.define('CatalogoValor', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    tipo: { type: DataTypes.STRING(50), allowNull: false },
    valor: { type: DataTypes.STRING(100), allowNull: false },
    etiqueta: { type: DataTypes.STRING(100), allowNull: true }
  }, {
    tableName: 'catalogo_valores',
    timestamps: false,
    defaultScope: { order: [['tipo', 'ASC'], ['valor', 'ASC']] },
    uniqueKeys: {
      tipo_valor: { fields: ['tipo', 'valor'] }
    }
  });

  return CatalogoValor;
};
