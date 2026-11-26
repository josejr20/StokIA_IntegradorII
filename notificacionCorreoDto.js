class NotificacionCorreoDto {
  constructor(data) {
    this.id = data.id;
    this.alerta_id = data.alerta_id;
    this.destinatario = data.destinatario;
    this.estado = data.estado;
    this.proveedor = data.proveedor;
    this.fecha_envio = data.fecha_envio;
    // US-32 (HU-166): datos del historial de notificaciones
    this.rol = data.rol ?? null;
    this.asunto = data.asunto ?? null;
    this.intentos = data.intentos ?? 0;
    this.ultimo_error = data.ultimo_error ?? null;
    this.proximo_reintento = data.proximo_reintento ?? null;
    this.fecha_creacion = data.fecha_creacion ?? null;
    // Resumen de la alerta que originó el correo (solo cuando se consulta con la alerta incluida)
    this.alerta = data.alerta
      ? {
        id: data.alerta.id,
        tipo: data.alerta.tipo,
        severidad: data.alerta.severidad,
        producto_id: data.alerta.producto_id,
        lote_id: data.alerta.lote_id ?? null,
        mensaje: data.alerta.mensaje
      }
      : null;
  }

  static fromCreate(data) {
    return {
      alerta_id: data.alerta_id || null,
      destinatario: data.destinatario,
      estado: data.estado || 'pendiente',
      proveedor: data.proveedor || 'smtp',
      fecha_envio: data.fecha_envio || null
    };
  }
}

module.exports = { NotificacionCorreoDto };
