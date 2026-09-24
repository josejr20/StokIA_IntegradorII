class ImportacionVentaDto {
  constructor(data) {
    this.id = data.id;
    this.usuario_id = data.usuario_id;
    this.nombre_archivo = data.nombre_archivo;
    this.filas_procesadas = data.filas_procesadas;
    this.filas_con_error = data.filas_con_error;
    this.estado = data.estado;
    this.fecha = data.fecha;
  }

  static fromModel(importacion) {
    if (!importacion) return null;
    return new ImportacionVentaDto(importacion.toJSON ? importacion.toJSON() : importacion);
  }

  static fromCreate(body) {
    return {
      usuario_id: body.usuario_id || null,
      nombre_archivo: body.nombre_archivo
    };
  }
}

module.exports = { ImportacionVentaDto };
