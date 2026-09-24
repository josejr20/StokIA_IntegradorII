const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const RolPermiso = sequelize.define('RolPermiso', {
    rol_id: { type: DataTypes.INTEGER, primaryKey: true, references: { model: 'roles', key: 'id' } },
    permiso_id: { type: DataTypes.INTEGER, primaryKey: true, references: { model: 'permisos', key: 'id' } }
  }, {
    tableName: 'rol_permisos',
    timestamps: false
  });

  return RolPermiso;
};
