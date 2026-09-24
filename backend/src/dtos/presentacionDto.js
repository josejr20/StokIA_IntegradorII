class PresentacionDto {
  constructor(data) {
    this.id = data.id;
    this.nombre = data.nombre;
    this.descripcion = data.descripcion;
  }

  static fromModel(presentacion) {
    if (!presentacion) return null;
    return new PresentacionDto(presentacion.toJSON ? presentacion.toJSON() : presentacion);
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

module.exports = { PresentacionDto };
