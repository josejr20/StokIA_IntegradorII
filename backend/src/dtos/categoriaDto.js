class CategoriaDto {
  constructor(data) {
    this.id = data.id;
    this.nombre = data.nombre;
    this.descripcion = data.descripcion;
    this.vida_util_dias = data.vida_util_dias;
  }

  static fromModel(categoria) {
    if (!categoria) return null;
    return new CategoriaDto(categoria.toJSON ? categoria.toJSON() : categoria);
  }

  static fromCreate(body) {
    return { nombre: body.nombre, descripcion: body.descripcion || null, vida_util_dias: body.vida_util_dias || null };
  }

  static fromUpdate(body) {
    const data = {};
    if (body.nombre !== undefined) data.nombre = body.nombre;
    if (body.descripcion !== undefined) data.descripcion = body.descripcion;
    if (body.vida_util_dias !== undefined) data.vida_util_dias = body.vida_util_dias;
    return data;
  }
}

module.exports = { CategoriaDto };
