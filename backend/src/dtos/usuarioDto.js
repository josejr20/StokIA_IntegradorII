class UsuarioDto {
  constructor(data) {
    this.id = data.id;
    this.nombres = data.nombres || data.nombre || null;
    this.apellidos = data.apellidos || '';
    this.dni = data.dni || null;
    this.email = data.email;
    this.rol_id = data.rol_id;
    this.rol = data.rol && typeof data.rol === 'object' ? data.rol.nombre : data.rol;
    this.rol_nombre = data.rol_nombre || (data.rol && data.rol.nombre) || (typeof data.rol === 'string' ? data.rol : null);
    this.permisos = data.permisos || (data.rol && Array.isArray(data.rol.permisos)
      ? data.rol.permisos.map((permiso) => permiso.codigo)
      : []);
    this.activo = data.activo;
    this.fecha_creacion = data.fecha_creacion;
    this.ultimo_acceso = data.ultimo_acceso;
    this.is_staff = data.is_staff;
  }

  static fromModel(usuario) {
    if (!usuario) return null;
    const data = usuario.toJSON ? usuario.toJSON() : usuario;
    return new UsuarioDto({
      ...data,
      rol: data.rol || null,
      rol_nombre: data.rol ? (data.rol.nombre || data.rol) : data.rol_nombre,
      permisos: data.rol && Array.isArray(data.rol.permisos)
        ? data.rol.permisos.map((permiso) => permiso.codigo)
        : data.permisos || []
    });
  }

  static fromCreate(body) {
    return {
      nombres: body.nombres,
      apellidos: body.apellidos,
      dni: body.dni,
      email: body.email,
      password_hash: body.password_hash || body.password,
      rol_id: body.rol_id,
      activo: body.activo !== undefined ? body.activo : true
    };
  }

  static fromUpdate(body) {
    const data = {};
    if (body.nombres !== undefined) data.nombres = body.nombres;
    if (body.nombre !== undefined) data.nombres = body.nombre;
    if (body.apellidos !== undefined) data.apellidos = body.apellidos;
    if (body.dni !== undefined) data.dni = body.dni;
    if (body.email !== undefined) data.email = body.email;
    if (body.password !== undefined) data.password_hash = body.password;
    if (body.rol_id !== undefined) data.rol_id = body.rol_id;
    if (body.activo !== undefined) data.activo = body.activo;
    return data;
  }
}

module.exports = { UsuarioDto };
