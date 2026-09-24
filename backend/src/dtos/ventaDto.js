class VentaDto {
  constructor(data) {
    this.id = data.id;
    this.producto_id = data.producto_id;
    this.producto_nombre = data.producto_nombre || null;
    this.lote_id = data.lote_id;
    this.cantidad = data.cantidad;
    this.precio_unitario = data.precio_unitario;
    this.fecha_venta = data.fecha_venta;
    this.origen = data.origen;
    this.usuario_id = data.usuario_id;
    this.fecha_creacion = data.fecha_creacion;
  }

  static fromModel(venta) {
    if (!venta) return null;
    const data = venta.toJSON ? venta.toJSON() : venta;
    const producto = data.producto || {};
    return new VentaDto({ ...data, producto_nombre: producto.nombre || null });
  }

  static fromCreate(body) {
    return {
      producto_id: body.producto_id,
      lote_id: body.lote_id || null,
      cantidad: body.cantidad,
      precio_unitario: body.precio_unitario,
      fecha_venta: body.fecha_venta,
      origen: body.origen || 'manual',
      usuario_id: body.usuario_id || null
    };
  }
}

module.exports = { VentaDto };
