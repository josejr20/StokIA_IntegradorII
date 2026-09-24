class RolDto {
  constructor(data) {
    this.id = data.id;
    this.nombre = data.nombre;
    this.descripcion = data.descripcion;
    this.fecha_creacion = data.fecha_creacion;
  }

  static fromModel(rol) {
    if (!rol) return null;
    const data = rol.toJSON ? rol.toJSON() : rol;
    return new RolDto(data);
  }

  static fromCreate(body) {
    return { nombre: body.nombre, descripcion: body.descripcion || null };
  }

  static fromUpdate(body) {
    const data = {};
    if (body.nombre !== undefined) data.nombre = body.nombre;
    if (body.descripcion !== undefined) data.descripcion = body.descripcion;
    return data;
  }
}

module.exports = { RolDto };
