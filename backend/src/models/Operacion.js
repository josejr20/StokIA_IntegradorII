const { DataTypes } = require('sequelize');

/**
 * Cabecera de una operación de inventario: venta, devolución
 * de cliente o ajuste. Agrupa a muchos productos
 * (operacion_detalles) y a un cliente cuando corresponde.
 */
module.exports = (sequelize) => {
  const Operacion = sequelize.define('Operacion', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    /**
     * Se asigna despues de crear: PREFIJO + id (p. ej. V-000123).
     * Nullable mientras dura la creacion para que el numero sea
     * unico sin necesidad de un contador compartido.
     */
    numero: { type: DataTypes.STRING(20), allowNull: true, unique: true },
    /**
     * Clave que manda el frontend al confirmar. Si el mismo formulario
     * se envia dos veces (doble clic, reintento de red), la segunda
     * peticion devuelve la operacion ya creada en vez de duplicarla.
     */
    idempotency_key: { type: DataTypes.STRING(64), allowNull: true, unique: true },
    tipo: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: { isIn: [['venta', 'devolucion', 'ajuste']] }
    },
    cliente_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'clientes', key: 'id' }
    },
    usuario_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'usuarios', key: 'id' }
    },
    fecha: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    subtotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    impuesto_porcentaje: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    impuesto: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    total: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    /** Obligatorio en ajuste y devolucion; libre en venta. */
    motivo: { type: DataTypes.STRING(200), allowNull: true },
    /** Para devoluciones: la operación de venta original. */
    operacion_origen_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
      references: { model: 'operaciones', key: 'id' }
    },
    estado: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'activa',
      validate: { isIn: [['activa', 'anulada']] }
    },
    fecha_creacion: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'operaciones',
    timestamps: false,
    indexes: [
      { fields: ['numero'] },
      { fields: ['cliente_id'] },
      { fields: ['fecha'] },
      { fields: ['tipo'] },
      { fields: ['operacion_origen_id'] }
    ]
  });

  return Operacion;
};
