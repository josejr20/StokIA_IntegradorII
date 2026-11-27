/**
 * US-36 · DTO de salida de la auditoría.
 * Solo expone lo necesario del usuario (nombre y correo): nunca el hash ni otros datos.
 */
class AuditoriaDto {
  constructor(data) {
    this.id = data.id;
    this.usuario_id = data.usuario_id;
    this.usuario_nombre = data.usuario_nombre || null;
    this.usuario_email = data.usuario_email || null;
    this.accion = data.accion;
    this.entidad = data.entidad;
    this.entidad_id = data.entidad_id;
    this.detalle = data.detalle;
    this.fecha = data.fecha;
  }

  static fromModel(auditoria) {
    if (!auditoria) return null;
    const data = auditoria.toJSON ? auditoria.toJSON() : auditoria;
    const usuario = data.usuario || null;
    const nombre = usuario ? [usuario.nombres, usuario.apellidos].filter(Boolean).join(' ').trim() : '';

    return new AuditoriaDto({
      ...data,
      // id es BIGINT: el driver lo entrega como string, se normaliza a número.
      id: Number(data.id),
      usuario_nombre: nombre || null,
      usuario_email: usuario?.email || null,
    });
  }
}

module.exports = { AuditoriaDto };
