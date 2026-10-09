class ClienteDto {
  constructor(data) {
    this.id = data.id;
    this.nombre = data.nombre;
    this.documento = data.documento || null;
    this.activo = data.activo;
    this.fecha_creacion = data.fecha_creacion;
  }

  static fromModel(cliente) {
    if (!cliente) return null;
    return new ClienteDto(cliente.toJSON ? cliente.toJSON() : cliente);
  }
}

class OperacionDetalleDto {
  constructor(data) {
    this.id = Number(data.id);
    this.operacion_id = Number(data.operacion_id);
    this.producto_id = data.producto_id;
    this.producto_codigo = data.producto_codigo || null;
    this.producto_nombre = data.producto_nombre || null;
    this.lote_id = data.lote_id != null ? data.lote_id : null;
    this.lote_numero = data.lote_numero || null;
    this.cantidad = Number(data.cantidad);
    this.cantidad_disponible_devolucion = data.cantidad_disponible_devolucion !== undefined
      ? Number(data.cantidad_disponible_devolucion)
      : undefined;
    this.precio_unitario = Number(data.precio_unitario);
    this.subtotal = Number(data.subtotal);
  }

  static fromModel(detalle) {
    if (!detalle) return null;
    const data = detalle.toJSON ? detalle.toJSON() : detalle;
    const producto = data.producto || {};
    const lote = data.lote || {};
    return new OperacionDetalleDto({
      ...data,
      producto_codigo: producto.codigo || null,
      producto_nombre: producto.nombre || null,
      lote_numero: lote.numero_lote || null,
    });
  }
}

class ComprobanteDto {
  constructor(data) {
    this.id = Number(data.id);
    this.operacion_id = Number(data.operacion_id);
    this.numero = data.numero;
    this.tipo = data.tipo;
    this.datos = data.datos;
    this.fecha_creacion = data.fecha_creacion;
  }

  static fromModel(comprobante) {
    if (!comprobante) return null;
    return new ComprobanteDto(comprobante.toJSON ? comprobante.toJSON() : comprobante);
  }
}

class OperacionDto {
  constructor(data) {
    this.id = Number(data.id);
    this.numero = data.numero;
    this.tipo = data.tipo;
    this.cliente_id = data.cliente_id || null;
    this.cliente = data.cliente !== undefined ? ClienteDto.fromModel(data.cliente) : undefined;
    this.usuario_id = data.usuario_id || null;
    this.usuario_nombre = data.usuario_nombre || null;
    this.fecha = data.fecha;
    this.subtotal = Number(data.subtotal);
    this.impuesto_porcentaje = Number(data.impuesto_porcentaje);
    this.impuesto = Number(data.impuesto);
    this.total = Number(data.total);
    this.motivo = data.motivo || null;
    this.operacion_origen_id = data.operacion_origen_id != null
      ? Number(data.operacion_origen_id)
      : null;
    this.operacion_origen_numero = data.operacion_origen_numero || null;
    this.estado = data.estado;
    this.fecha_creacion = data.fecha_creacion;
    this.detalles = data.detalles !== undefined
      ? (data.detalles || []).map((d) => OperacionDetalleDto.fromModel(d))
      : undefined;
    this.comprobante = data.comprobante !== undefined
      ? ComprobanteDto.fromModel(data.comprobante)
      : undefined;
  }

  static fromModel(operacion) {
    if (!operacion) return null;
    const data = operacion.toJSON ? operacion.toJSON() : operacion;
    const usuario = data.usuario || {};
    const origen = data.operacionOrigen || {};
    return new OperacionDto({
      ...data,
      usuario_nombre: usuario.nombres || usuario.email || null,
      operacion_origen_numero: origen.numero || null,
    });
  }
}

module.exports = { ClienteDto, OperacionDto, OperacionDetalleDto, ComprobanteDto };
