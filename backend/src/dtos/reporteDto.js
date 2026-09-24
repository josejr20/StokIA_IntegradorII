class ReporteDto {
  constructor(data) {
    this.id = data.id;
    this.usuario_id = data.usuario_id;
    this.tipo = data.tipo;
    this.formato = data.formato;
    this.parametros = data.parametros;
    this.ruta_archivo = data.ruta_archivo;
    this.fecha_generacion = data.fecha_generacion;
  }

  static fromModel(reporte) {
    if (!reporte) return null;
    return new ReporteDto(reporte.toJSON ? reporte.toJSON() : reporte);
  }

  static fromCreate(body) {
    return {
      usuario_id: body.usuario_id,
      tipo: body.tipo,
      formato: body.formato,
      parametros: body.parametros || null,
      ruta_archivo: body.ruta_archivo || null
    };
  }
}

module.exports = { ReporteDto };
