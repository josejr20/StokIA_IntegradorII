class NotificacionCorreoDto {
  constructor(data) {
    this.id = data.id;
    this.alerta_id = data.alerta_id;
    this.destinatario = data.destinatario;
    this.estado = data.estado;
    this.proveedor = data.proveedor;
    this.fecha_envio = data.fecha_envio;
  }

  static fromCreate(data) {
    return {
      alerta_id: data.alerta_id || null,
      destinatario: data.destinatario,
      estado: data.estado || 'pendiente',
      proveedor: data.proveedor || 'brevo',
      fecha_envio: data.fecha_envio || null
    };
  }
}

module.exports = { NotificacionCorreoDto };
