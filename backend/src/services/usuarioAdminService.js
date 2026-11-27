'use strict';

// HU-178 (US-35): reglas del panel de administración de usuarios.
// Valida la edición y la desactivación de usuarios sin consultar la base directamente:
// usa un repositorio inyectable, igual que otros servicios del proyecto, para poder probarlo sin conexión.

const { cumplePoliticaPassword } = require('../utils/passwordPolicy');

const ROL_ADMINISTRADOR = 'administrador';

class ErrorUsuario extends Error {
  constructor(status, mensaje) {
    super(mensaje);
    this.name = 'ErrorUsuario';
    this.status = status;
  }
}

function esAdministrador(usuario) {
  const nombre = usuario?.rol?.nombre ?? (typeof usuario?.rol === 'string' ? usuario.rol : '');
  return String(nombre).trim().toLocaleLowerCase() === ROL_ADMINISTRADOR;
}

/**
 * Impide dejar el sistema sin administradores activos o que un administrador se desactive a sí mismo.
 * `dejaDeSerAdminActivo` indica que el cambio quita el rol de administrador o desactiva la cuenta.
 */
async function validarQueQuedeAdministrador({ usuario, repositorio, dejaDeSerAdminActivo }) {
  if (!dejaDeSerAdminActivo || !esAdministrador(usuario) || !usuario.activo) return;
  const activos = await repositorio.contarAdministradoresActivos();
  if (activos <= 1) {
    throw new ErrorUsuario(400, 'Debe quedar al menos un administrador activo en el sistema');
  }
}

async function validarDesactivacion({ usuario, solicitanteId, repositorio }) {
  if (Number(usuario.id) === Number(solicitanteId)) {
    throw new ErrorUsuario(400, 'No puedes desactivar tu propio usuario');
  }
  await validarQueQuedeAdministrador({ usuario, repositorio, dejaDeSerAdminActivo: true });
}

/**
 * Valida los datos de edición y devuelve solo los campos que se pueden guardar.
 * Lanza ErrorUsuario (400 datos inválidos, 409 duplicado) con un mensaje listo para mostrar.
 */
async function prepararEdicion({ cuerpo, usuario, solicitanteId, repositorio }) {
  const datos = {};

  if (cuerpo.nombres !== undefined) {
    if (typeof cuerpo.nombres !== 'string' || cuerpo.nombres.trim().length < 2) {
      throw new ErrorUsuario(400, 'Ingresa los nombres del empleado');
    }
    datos.nombres = cuerpo.nombres.trim();
  }

  if (cuerpo.apellidos !== undefined) {
    if (typeof cuerpo.apellidos !== 'string' || cuerpo.apellidos.trim().length < 2) {
      throw new ErrorUsuario(400, 'Ingresa los apellidos del empleado');
    }
    datos.apellidos = cuerpo.apellidos.trim();
  }

  if (cuerpo.dni !== undefined) {
    if (typeof cuerpo.dni !== 'string' || !cuerpo.dni.trim()) {
      throw new ErrorUsuario(400, 'Ingresa el DNI del empleado');
    }
    const dni = cuerpo.dni.trim();
    const otro = await repositorio.buscarPorDni(dni);
    if (otro && Number(otro.id) !== Number(usuario.id)) {
      throw new ErrorUsuario(409, 'El DNI ya está registrado');
    }
    datos.dni = dni;
  }

  if (cuerpo.email !== undefined) {
    if (typeof cuerpo.email !== 'string' || !/^\S+@\S+\.\S+$/.test(cuerpo.email.trim())) {
      throw new ErrorUsuario(400, 'Ingresa un correo válido');
    }
    const email = cuerpo.email.trim().toLowerCase();
    const otro = await repositorio.buscarPorEmail(email);
    if (otro && Number(otro.id) !== Number(usuario.id)) {
      throw new ErrorUsuario(409, 'El correo ya está registrado');
    }
    datos.email = email;
  }

  // La contraseña es opcional al editar: vacía significa "no cambiar".
  if (cuerpo.password !== undefined && cuerpo.password !== '') {
    if (!cumplePoliticaPassword(cuerpo.password)) {
      throw new ErrorUsuario(
        400,
        'La contraseña debe tener al menos 8 caracteres, mayúscula, minúscula, número y símbolo',
      );
    }
    datos.password_hash = cuerpo.password;
  }

  if (cuerpo.rol_id !== undefined) {
    const rol = await repositorio.buscarRol(Number(cuerpo.rol_id));
    if (!rol) throw new ErrorUsuario(400, 'Selecciona un rol válido');
    if (Number(rol.id) !== Number(usuario.rol_id)) {
      await validarQueQuedeAdministrador({
        usuario,
        repositorio,
        dejaDeSerAdminActivo: String(rol.nombre).trim().toLocaleLowerCase() !== ROL_ADMINISTRADOR,
      });
      datos.rol_id = rol.id;
    }
  }

  if (cuerpo.activo !== undefined) {
    if (typeof cuerpo.activo !== 'boolean') throw new ErrorUsuario(400, 'El estado del usuario no es válido');
    if (cuerpo.activo === false && usuario.activo) {
      await validarDesactivacion({ usuario, solicitanteId, repositorio });
    }
    datos.activo = cuerpo.activo;
  }

  return datos;
}

module.exports = { prepararEdicion, validarDesactivacion, ErrorUsuario, esAdministrador };