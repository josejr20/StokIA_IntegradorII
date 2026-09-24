class PreferenciaDto {
  constructor(data) {
    this.id = data.id;
    this.usuario_id = data.usuario_id;
    this.clave = data.clave;
    this.valor = data.valor;
    this.fecha_actualizacion = data.fecha_actualizacion;
  }

  static fromModel(preferencia) {
    if (!preferencia) return null;
    return new PreferenciaDto(preferencia.toJSON ? preferencia.toJSON() : preferencia);
  }

  static fromCreate(body) {
    return { usuario_id: body.usuario_id, clave: body.clave, valor: body.valor };
  }

  static fromUpdate(body) {
    const data = {};
    if (body.valor !== undefined) data.valor = body.valor;
    return data;
  }
}

module.exports = { PreferenciaDto };
