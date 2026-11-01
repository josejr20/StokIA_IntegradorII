const { DataTypes } = require('sequelize');

/**
 * Comprobante generado al confirmar una operación. Guarda el
 * snapshot completo (datos) para poder ver, descargar e
 * imprimir la factura después, incluso si el producto o el
 * cliente cambian. Una operación tiene un solo comprobante.
 *
 * `tipo` deja lugar a una futura integración con facturación
 * electrónica SUNAT sin tocar el módulo de ventas: boleta y
 * factura son los comprobantes de venta, nota_credito los de
 * devolución.
 */
module.exports = (sequelize) => {
  const Comprobante = sequelize.define('Comprobante', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    operacion_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      unique: true,
      references: { model: 'operaciones', key: 'id' }
    },
    /**
     * Se asigna despues de crear a partir del id de la
     * operacion (p. ej. B-000123 / NC-000123).
     */
    numero: { type: DataTypes.STRING(20), allowNull: true, unique: true },
    tipo: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'boleta',
      validate: { isIn: [['boleta', 'factura', 'nota_credito']] }
    },
    datos: { type: DataTypes.JSONB, allowNull: false },
    fecha_creacion: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'comprobantes',
    timestamps: false,
    indexes: [{ fields: ['numero'] }]
  });

  return Comprobante;
};
