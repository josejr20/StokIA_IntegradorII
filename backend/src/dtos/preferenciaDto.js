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

    const data = preferencia.toJSON
      ? preferencia.toJSON()
      : preferencia;

    return new PreferenciaDto(data);
  }

  static fromCreate(body) {
    return {
      clave: body.clave.trim(),
      valor: body.valor
    };
  }

  static fromUpdate(body) {
    const data = {};

    if (body.valor !== undefined) {
      data.valor = body.valor;
    }

    return data;
  }
}

module.exports = { PreferenciaDto };