class ProductoDto {
  constructor(data) {
    this.id = data.id;
    this.codigo = data.codigo;
    this.nombre = data.nombre;
    this.categoria_id = data.categoria_id;
    this.categoria_nombre = data.categoria_nombre || null;
    this.categoria_vida_util_dias = data.categoria_vida_util_dias || null;
    this.unidad_medida_id = data.unidad_medida_id;
    this.unidad_medida_nombre = data.unidad_medida_nombre || null;
    this.unidad_medida_simbolo = data.unidad_medida_simbolo || null;
    this.presentacion_id = data.presentacion_id;
    this.presentacion_nombre = data.presentacion_nombre || null;
    this.marca_id = data.marca_id;
    this.marca_nombre = data.marca_nombre || null;
    this.contenido_valor = data.contenido_valor || null;
    this.categoria_paquete_id = data.categoria_paquete_id || null;
    this.categoria_paquete_nombre = data.categoria_paquete_nombre || null;
    this.contenido_paquete_cantidad = data.contenido_paquete_cantidad || null;
    this.contenido_paquete_envase_id = data.contenido_paquete_envase_id || null;
    this.contenido_paquete_envase_nombre = data.contenido_paquete_envase_nombre || null;
    this.precio_venta = data.precio_venta;
    this.caracteristicas = data.caracteristicas || {};
    this.imagen = data.imagen;
    this.descripcion = data.descripcion;
    this.activo = data.activo;
    this.motivo_desactivacion = data.motivo_desactivacion;
    this.motivo_desactivacion_detalle = data.motivo_desactivacion_detalle;
    this.fecha_desactivacion = data.fecha_desactivacion;
    this.stock_total = data.stock_total || 0;
    this.fecha_creacion = data.fecha_creacion;
    this.fecha_actualizacion = data.fecha_actualizacion;
  }

  static fromModel(producto) {
    if (!producto) return null;
    const data = producto.toJSON ? producto.toJSON() : producto;
    const categoria = data.categoria || {};
    const unidadMedida = data.unidadMedida || {};
    const presentacion = data.presentacion || {};
    const marca = data.marca || {};
    const categoriaPaquete = data.categoriaPaquete || {};
    const envaseContenido = data.envaseContenido || {};
    return new ProductoDto({
      ...data,
      categoria_nombre: categoria.nombre || null,
      categoria_vida_util_dias: categoria.vida_util_dias || null,
      unidad_medida_nombre: unidadMedida.nombre || null,
      unidad_medida_simbolo: unidadMedida.abreviatura || unidadMedida.simbolo || unidadMedida.nombre || null,
      presentacion_nombre: presentacion.nombre || null,
      marca_nombre: marca.nombre || null,
      categoria_paquete_nombre: categoriaPaquete.nombre || null,
      contenido_paquete_envase_nombre: envaseContenido.nombre || null,
      stock_total: 0
    });
  }

  static fromCreate(body) {
    return {
      codigo: body.codigo,
      nombre: body.nombre,
      categoria_id: body.categoria_id || null,
      unidad_medida_id: body.unidad_medida_id || null,
      presentacion_id: body.presentacion_id || null,
      marca_id: body.marca_id || null,
      categoria_paquete_id: body.categoria_paquete_id || null,
      contenido_valor: body.contenido_valor || null,
      contenido_paquete_cantidad: body.contenido_paquete_cantidad || null,
      contenido_paquete_envase_id: body.contenido_paquete_envase_id || null,
      precio_venta: body.precio_venta || null,
      caracteristicas: body.caracteristicas || {},
      imagen: body.imagen || null,
      descripcion: body.descripcion || null,
      activo: body.activo !== undefined ? body.activo : true
    };
  }

  static fromUpdate(body) {
    const data = {};
    if (body.nombre !== undefined) data.nombre = body.nombre;
    if (body.descripcion !== undefined) data.descripcion = body.descripcion;
    if (body.categoria_id !== undefined) data.categoria_id = body.categoria_id;
    if (body.unidad_medida_id !== undefined) data.unidad_medida_id = body.unidad_medida_id;
    if (body.presentacion_id !== undefined) data.presentacion_id = body.presentacion_id;
    if (body.marca_id !== undefined) data.marca_id = body.marca_id;
    if (body.categoria_paquete_id !== undefined) data.categoria_paquete_id = body.categoria_paquete_id;
    if (body.contenido_valor !== undefined) data.contenido_valor = body.contenido_valor;
    if (body.contenido_paquete_cantidad !== undefined) data.contenido_paquete_cantidad = body.contenido_paquete_cantidad;
    if (body.contenido_paquete_envase_id !== undefined) data.contenido_paquete_envase_id = body.contenido_paquete_envase_id;
    if (body.precio_venta !== undefined) data.precio_venta = body.precio_venta;
    if (body.caracteristicas !== undefined) data.caracteristicas = body.caracteristicas;
    if (body.activo !== undefined) data.activo = body.activo;
    return data;
  }
}

module.exports = { ProductoDto };
