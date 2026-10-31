const { calcularEstadoLote, diasHastaVencimiento } = require('../services/loteService');

class LoteDto {
  constructor(data) {
    this.id = data.id;
    this.producto_id = data.producto_id;
    this.producto_nombre = data.producto_nombre || null;
    this.numero_lote = data.numero_lote;
    this.cantidad_inicial = data.cantidad_inicial;
    this.cantidad_actual = data.cantidad_actual;
    this.fecha_ingreso = data.fecha_ingreso;
    this.fecha_vencimiento = data.fecha_vencimiento;
    this.fecha_creacion = data.fecha_creacion;
    this.dias_para_vencer = diasHastaVencimiento(data.fecha_vencimiento) ?? null;
    this.estado = calcularEstadoLote(data);
  }

  static fromModel(lote) {
    if (!lote) return null;
    const data = lote.toJSON ? lote.toJSON() : lote;
    return new LoteDto({
      ...data,
      producto_nombre: data.producto ? (data.producto.nombre || null) : null,
      dias_alerta_vencimiento: data.dias_alerta_vencimiento ?? 30
    });
  }

  static fromCreate(body) {
    const cantidadInicial = Number(body.cantidad_inicial ?? body.cantidad_actual ?? 0);
    return {
      producto_id: body.producto_id,
      numero_lote: body.numero_lote,
      cantidad_inicial: cantidadInicial,
      cantidad_actual: 0,
      fecha_vencimiento: typeof body.fecha_vencimiento === 'string'
        ? body.fecha_vencimiento.trim() || null
        : body.fecha_vencimiento ?? null,
      fecha_ingreso: body.fecha_ingreso || new Date()
    };
  }

  static fromUpdate(body) {
    const data = {};
    if (body.numero_lote !== undefined) data.numero_lote = body.numero_lote;
    return data;
  }
}

module.exports = { LoteDto };
