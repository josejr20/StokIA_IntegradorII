class CatalogoMarcaDto {
  constructor(data) {
    this.id = data.id;
    this.nombre = data.nombre;
    this.familias = data.familias || [];
  }

  static fromModel(marca) {
    if (!marca) return null;
    const data = marca.toJSON ? marca.toJSON() : marca;
    return new CatalogoMarcaDto({ ...data, familias: (data.familias || []).map(f => f.id || f) });
  }

  static fromCreate(body) {
    return { nombre: body.nombre };
  }

  static fromUpdate(body) {
    const data = {};
    if (body.nombre !== undefined) data.nombre = body.nombre;
    return data;
  }
}

module.exports = { CatalogoMarcaDto };
