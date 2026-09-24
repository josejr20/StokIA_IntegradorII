class AuditoriaDto {
  constructor(data) {
    this.id = data.id;
    this.usuario_id = data.usuario_id;
    this.usuario_nombre = data.usuario_nombre || null;
    this.accion = data.accion;
    this.entidad = data.entidad;
    this.entidad_id = data.entidad_id;
    this.detalle = data.detalle;
    this.fecha = data.fecha;
  }

  static fromModel(auditoria) {
    if (!auditoria) return null;
    const data = auditoria.toJSON ? auditoria.toJSON() : auditoria;
    const usuario = data.usuario || {};
    return new AuditoriaDto({ ...data, usuario_nombre: usuario.nombre || null });
  }
}

module.exports = { AuditoriaDto };
