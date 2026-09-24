class AlertaDto {
  constructor(data) {
    this.id = data.id;
    this.tipo = data.tipo;
    this.producto_id = data.producto_id;
    this.producto_nombre = data.producto_nombre || null;
    this.lote_id = data.lote_id;
    this.mensaje = data.mensaje;
    this.severidad = data.severidad;
    this.datos_origen = data.datos_origen;
    this.estado = data.estado;
    this.fecha_creacion = data.fecha_creacion;
    this.fecha_atendida = data.fecha_atendida;
  }

  static fromModel(alerta) {
    if (!alerta) return null;
    const data = alerta.toJSON ? alerta.toJSON() : alerta;
    const producto = data.producto || {};
    return new AlertaDto({ ...data, producto_nombre: producto.nombre || null });
  }

  static fromCreate(body) {
    return {
      tipo: body.tipo,
      producto_id: body.producto_id,
      lote_id: body.lote_id || null,
      mensaje: body.mensaje,
      severidad: body.severidad || 'media',
      datos_origen: body.datos_origen || null
    };
  }

  static fromUpdate(body) {
    const data = {};
    if (body.estado !== undefined) data.estado = body.estado;
    return data;
  }
}

module.exports = { AlertaDto };
