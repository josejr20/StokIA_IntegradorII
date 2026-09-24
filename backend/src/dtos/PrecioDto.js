class PrecioDto {
  constructor(data) {
    this.id = data.id;
    this.producto_id = data.producto_id;
    this.precioLista = data.precioLista;
    this.precioDescuento = data.precioDescuento;
    this.vigente_desde = data.vigente_desde;
    this.creado_en = data.creado_en;
  }

  static fromModel(precio) {
    if (!precio) return null;
    return new PrecioDto(precio.toJSON ? precio.toJSON() : precio);
  }

  static fromCreate(body) {
    return {
      producto_id: body.producto_id,
      precioLista: body.precioLista,
      precioDescuento: body.precioDescuento || null,
      vigente_desde: body.vigente_desde || new Date()
    };
  }
}

module.exports = { PrecioDto };