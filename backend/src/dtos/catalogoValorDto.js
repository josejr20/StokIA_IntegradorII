class CatalogoValorDto {
  constructor(data) {
    this.id = data.id;
    this.tipo = data.tipo;
    this.valor = data.valor;
    this.etiqueta = data.etiqueta;
  }

  static fromModel(valor) {
    if (!valor) return null;
    return new CatalogoValorDto(valor.toJSON ? valor.toJSON() : valor);
  }

  static fromCreate(body) {
    return { tipo: body.tipo, valor: body.valor, etiqueta: body.etiqueta || null };
  }

  static fromUpdate(body) {
    const data = {};
    if (body.tipo !== undefined) data.tipo = body.tipo;
    if (body.valor !== undefined) data.valor = body.valor;
    if (body.etiqueta !== undefined) data.etiqueta = body.etiqueta;
    return data;
  }
}

module.exports = { CatalogoValorDto };
