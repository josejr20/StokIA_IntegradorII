class ProductoPresentacionDto {
  constructor(data) {
    this.id = data.id;
    this.producto_id = data.producto_id;
    this.nivel = data.nivel;
    this.envase_id = data.envase_id;
    this.cantidad = data.cantidad;
    this.envase_nombre = data.envase_nombre || null;
  }

  static fromModel(pp) {
    if (!pp) return null;
    const data = pp.toJSON ? pp.toJSON() : pp;
    const envase = data.envase || {};
    return new ProductoPresentacionDto({
      ...data,
      envase_nombre: envase.nombre || null
    });
  }

  static fromCreate(body) {
    return {
      producto_id: body.producto_id,
      nivel: body.nivel,
      envase_id: body.envase_id,
      cantidad: body.cantidad
    };
  }
}

module.exports = { ProductoPresentacionDto };