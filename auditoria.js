const { DataTypes } = require('sequelize');

const MENSAJE_SOLO_LECTURA =
  'La tabla auditoria es de solo lectura: los registros no se pueden modificar ni eliminar';

/** Hook que aborta cualquier operación de edición/borrado (SEC-01 / TC-06). */
const bloquear = () => {
  throw new Error(MENSAJE_SOLO_LECTURA);
};

module.exports = (sequelize) => {
  const Auditoria = sequelize.define('Auditoria', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    usuario_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'usuarios', key: 'id' } },
    accion: { type: DataTypes.STRING(100), allowNull: false },
    entidad: { type: DataTypes.STRING(80), allowNull: false },
    entidad_id: { type: DataTypes.INTEGER, allowNull: true },
    detalle: { type: DataTypes.JSONB, allowNull: true },
    fecha: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'auditoria',
    timestamps: false,
    indexes: [
      { fields: ['entidad'] },
      { fields: ['usuario_id'] },
      { fields: ['fecha'] }
    ],
    // Segunda barrera de inmutabilidad (la primera es el trigger en PostgreSQL,
    // ver sql/auditoria_us36.sql). Solo se permite INSERT y SELECT.
    hooks: {
      beforeUpdate: bloquear,       // instancia.save() sobre un registro existente
      beforeDestroy: bloquear,      // instancia.destroy()
      beforeBulkUpdate: bloquear,   // Auditoria.update(...)
      beforeBulkDestroy: bloquear,  // Auditoria.destroy(...) / truncate
      beforeUpsert: bloquear,       // Auditoria.upsert(...)
    },
  });

  return Auditoria;
};
