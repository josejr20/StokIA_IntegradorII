class OrdenReabastecimientoDto {
  constructor(data) {
    this.id = data.id;
    this.producto_id = data.producto_id;
    this.producto_nombre = data.producto_nombre || null;
    this.cantidad_sugerida = data.cantidad_sugerida;
    this.cantidad_aprobada = data.cantidad_aprobada;
    this.estado = data.estado;
    this.generado_por = data.generado_por;
    this.usuario_id = data.usuario_id;
    this.fecha_creacion = data.fecha_creacion;
    this.fecha_actualizacion = data.fecha_actualizacion;
  }

  static fromModel(orden) {
    if (!orden) return null;
    const data = orden.toJSON ? orden.toJSON() : orden;
    const producto = data.producto || {};
    return new OrdenReabastecimientoDto({ ...data, producto_nombre: producto.nombre || null });
  }

  static fromCreate(body) {
    return {
      producto_id: body.producto_id,
      cantidad_sugerida: body.cantidad_sugerida,
      generado_por: body.generado_por || 'automatico',
      usuario_id: body.usuario_id || null
    };
  }
}

module.exports = { OrdenReabastecimientoDto };
