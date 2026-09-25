class MovimientoDto {
  constructor(data) {
    this.id = data.id;
    this.lote_id = data.lote_id;
    this.lote_numero = data.lote_numero || null;
    this.producto_id = data.producto_id || null;
    this.producto_nombre = data.producto_nombre || null;
    this.producto_codigo = data.producto_codigo || null;
    this.tipo = data.tipo;
    this.origen = data.origen;
    this.cantidad = data.cantidad;
    this.precio_unitario = data.precio_unitario;
    this.precio_total = data.precio_total;
    this.saldo_cantidad = data.saldo_cantidad;
    this.saldo_precio_unitario = data.saldo_precio_unitario;
    this.saldo_valorizado = data.saldo_valorizado;
    this.motivo = data.motivo;
    this.usuario_id = data.usuario_id;
    this.usuario_nombre = data.usuario_nombre || null;
    this.fecha = data.fecha;
    this.tipo_display = data.tipo_display || null;
    this.origen_display = data.origen_display || null;
  }

  static fromModel(movimiento) {
    if (!movimiento) return null;
    const data = movimiento.toJSON ? movimiento.toJSON() : movimiento;
    const lote = data.lote || {};
    const producto = lote.producto || {};
    const usuario = data.usuario || {};
    return new MovimientoDto({
      ...data,
      lote_numero: lote.numero_lote || null,
      producto_id: producto.id || null,
      producto_nombre: producto.nombre || null,
      producto_codigo: producto.codigo || null,
      usuario_nombre: usuario.nombre || null,
      tipo_display: MovimientoDto.tipoDisplay(data.tipo),
      origen_display: MovimientoDto.origenDisplay(data.origen)
    });
  }

  static tipoDisplay(tipo) {
    return { ingreso: 'Ingreso', salida: 'Salida', ajuste: 'Ajuste' }[tipo] || tipo || null;
  }

  static origenDisplay(origen) {
    return {
      compra: 'Compra',
      venta: 'Venta',
      inicial: 'Registro inicial',
      ajuste: 'Ajuste de inventario',
      otro: 'Otro',
    }[origen] || origen || null;
  }

  static fromCreate(body) {
    return {
      lote_id: body.lote_id,
      tipo: body.tipo,
      origen: body.origen || 'otro',
      cantidad: body.cantidad,
      precio_unitario: body.precio_unitario || null,
      motivo: body.motivo || '',
      usuario_id: body.usuario_id || null
    };
  }
}

module.exports = { MovimientoDto };
