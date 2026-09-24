class PermisoDto {
  constructor(data) {
    this.id = data.id;
    this.codigo = data.codigo;
    this.descripcion = data.descripcion;
  }

  static fromModel(permiso) {
    if (!permiso) return null;
    return new PermisoDto(permiso.toJSON ? permiso.toJSON() : permiso);
  }

  static fromCreate(body) {
    return { codigo: body.codigo, descripcion: body.descripcion || null };
  }

  static fromUpdate(body) {
    const data = {};
    if (body.codigo !== undefined) data.codigo = body.codigo;
    if (body.descripcion !== undefined) data.descripcion = body.descripcion;
    return data;
  }
}

module.exports = { PermisoDto };
