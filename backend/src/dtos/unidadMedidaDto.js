class UnidadMedidaDto {
  constructor(data) {
    this.id = data.id;
    this.nombre = data.nombre;
    this.abreviatura = data.abreviatura;
    this.simbolo = data.simbolo || data.abreviatura;
  }

  static fromModel(unidad) {
    if (!unidad) return null;
    return new UnidadMedidaDto(unidad.toJSON ? unidad.toJSON() : unidad);
  }

  static fromCreate(body) {
    return { nombre: body.nombre, abreviatura: body.abreviatura, simbolo: body.simbolo || body.abreviatura };
  }

  static fromUpdate(body) {
    const data = {};
    if (body.nombre !== undefined) data.nombre = body.nombre;
    if (body.abreviatura !== undefined) data.abreviatura = body.abreviatura;
    if (body.simbolo !== undefined) data.simbolo = body.simbolo;
    return data;
  }
}

module.exports = { UnidadMedidaDto };
