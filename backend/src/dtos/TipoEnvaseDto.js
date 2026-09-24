class TipoEnvaseDto {
  constructor(data) {
    this.id = data.id;
    this.nombre = data.nombre;
    this.activo = data.activo;
    this.creado_en = data.creado_en;
  }

  static fromModel(tipoEnvase) {
    if (!tipoEnvase) return null;
    return new TipoEnvaseDto(tipoEnvase.toJSON ? tipoEnvase.toJSON() : tipoEnvase);
  }

  static fromCreate(body) {
    return { nombre: body.nombre, activo: body.activo !== undefined ? body.activo : true };
  }

  static fromUpdate(body) {
    const data = {};
    if (body.nombre !== undefined) data.nombre = body.nombre;
    if (body.activo !== undefined) data.activo = body.activo;
    return data;
  }
}

module.exports = { TipoEnvaseDto };