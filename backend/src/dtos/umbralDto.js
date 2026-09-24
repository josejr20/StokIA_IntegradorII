class UmbralDto {
  constructor(data) {
    this.id = data.id;
    this.tipo = data.tipo;
    this.producto_id = data.producto_id;
    this.producto_nombre = data.producto_nombre || null;
    this.valor = data.valor;
    this.usuario_id = data.usuario_id;
    this.fecha_actualizacion = data.fecha_actualizacion;
  }

  static fromModel(umbral) {
    if (!umbral) return null;
    const data = umbral.toJSON ? umbral.toJSON() : umbral;
    const producto = data.producto || {};
    return new UmbralDto({ ...data, producto_nombre: producto.nombre || null });
  }

  static fromCreate(body) {
    return {
      tipo: body.tipo,
      producto_id: body.producto_id || null,
      valor: body.valor
    };
  }

  static fromUpdate(body) {
    const data = {};
    if (body.tipo !== undefined) data.tipo = body.tipo;
    if (body.producto_id !== undefined) data.producto_id = body.producto_id;
    if (body.valor !== undefined) data.valor = body.valor;
    return data;
  }
}

module.exports = { UmbralDto };
