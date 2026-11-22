'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const models = require('../../src/models');

const correoPath = require.resolve('../../src/services/correoService');
const correoOriginal = require(correoPath);
const controllerPath = require.resolve('../../src/controllers/authController');
const correosEnviados = [];
require.cache[correoPath].exports = {
  enviarCorreo: async (...argumentos) => { correosEnviados.push(argumentos); },
};
delete require.cache[controllerPath];
const { forgotPassword, resetPassword, changePassword } = require(controllerPath);
require.cache[correoPath].exports = correoOriginal;
delete require.cache[controllerPath];

function crearRespuesta() {
  return {
    statusCode: 200,
    body: null,
    status(codigo) { this.statusCode = codigo; return this; },
    json(contenido) { this.body = contenido; return this; },
    clearCookie() {},
  };
}

test('password recovery and authenticated password change enforce their rules', async () => {
  const originales = {
    findOneUsuario: models.Usuario.findOne,
    findByPkUsuario: models.Usuario.findByPk,
    updateToken: models.TokenRecuperacion.update,
    createToken: models.TokenRecuperacion.create,
    findOneToken: models.TokenRecuperacion.findOne,
  };
  const usuario = {
    id: 8,
    activo: true,
    actualizaciones: [],
    password_hash: await bcrypt.hash('OldPass123!', 10),
    async update(cambios) {
      Object.assign(this, cambios);
      this.actualizaciones.push(cambios);
    },
  };
  let tokenGuardado;
  let usuarioExiste = false;
  correosEnviados.length = 0;

  models.Usuario.findOne = async () => usuarioExiste ? usuario : null;
  models.Usuario.findByPk = async () => usuario;
  models.TokenRecuperacion.update = async (cambios, opciones) => {
    if (opciones.where.id !== undefined) {
      if (!tokenGuardado || tokenGuardado.usado || opciones.where.token !== tokenGuardado.token) return [0];
      Object.assign(tokenGuardado, cambios);
    }
    return [1];
  };
  models.TokenRecuperacion.create = async (valores) => {
    tokenGuardado = { id: 22, ...valores };
    tokenGuardado.update = async (cambios) => Object.assign(tokenGuardado, cambios);
    return tokenGuardado;
  };
  models.TokenRecuperacion.findOne = async ({ where }) => (
    tokenGuardado && tokenGuardado.token === where.token && !tokenGuardado.usado
      ? tokenGuardado
      : null
  );

  try {
    const respuestaCorreoInexistente = crearRespuesta();
    await forgotPassword({ body: { email: 'no-existe@example.com' } }, respuestaCorreoInexistente);
    assert.equal(respuestaCorreoInexistente.statusCode, 200);
    assert.equal(correosEnviados.length, 0);

    usuarioExiste = true;
    const inicio = Date.now();
    const respuestaSolicitud = crearRespuesta();
    await forgotPassword({ body: { email: 'Usuario@example.com' } }, respuestaSolicitud);
    assert.match(respuestaSolicitud.body.message, /enlace de recuperación/);
    assert.equal(correosEnviados.length, 1);
    assert.equal(correosEnviados[0][0], 'usuario@example.com');

    const enlace = new URL(correosEnviados[0][2].match(/href="([^"]+)"/)[1]);
    const token = enlace.searchParams.get('token');
    assert.equal(enlace.pathname, '/restablecer');
    assert.match(token, /^[a-f0-9]{64}$/);
    assert.equal(tokenGuardado.token, crypto.createHash('sha256').update(token).digest('hex'));
    assert.ok(Math.abs(tokenGuardado.expira_en.getTime() - inicio - 10 * 60 * 1000) < 100);
    assert.match(correosEnviados[0][2], /10 minutos/);
    assert.doesNotMatch(correosEnviados[0][2], /\b\d{6}\b/);

    const usuarioActualizacionesIniciales = usuario.actualizaciones.length;
    tokenGuardado.expira_en = new Date(Date.now() - 1);
    const respuestaExpirado = crearRespuesta();
    await resetPassword({ body: { token, currentPassword: 'OldPass123!', password: 'NewPass123!' } }, respuestaExpirado);
    assert.equal(respuestaExpirado.statusCode, 400);
    assert.equal(usuario.actualizaciones.length, usuarioActualizacionesIniciales);

    tokenGuardado.expira_en = new Date(Date.now() + 60_000);
    const respuestaPasswordIncorrectaReset = crearRespuesta();
    await resetPassword({ body: { token, currentPassword: 'Incorrecta123!', password: 'x' } }, respuestaPasswordIncorrectaReset);
    assert.equal(respuestaPasswordIncorrectaReset.statusCode, 400);
    assert.match(respuestaPasswordIncorrectaReset.body.error, /contraseña actual es incorrecta/);
    assert.equal(usuario.actualizaciones.length, usuarioActualizacionesIniciales);

    const respuestaMismaPasswordReset = crearRespuesta();
    await resetPassword({ body: { token, currentPassword: 'OldPass123!', password: 'OldPass123!' } }, respuestaMismaPasswordReset);
    assert.equal(respuestaMismaPasswordReset.statusCode, 400);
    assert.match(respuestaMismaPasswordReset.body.error, /debe ser diferente/);
    assert.equal(usuario.actualizaciones.length, usuarioActualizacionesIniciales);

    const respuestaRestablecimiento = crearRespuesta();
    await resetPassword({ body: { token, currentPassword: 'OldPass123!', password: 'NewPass123!' } }, respuestaRestablecimiento);
    assert.equal(respuestaRestablecimiento.statusCode, 200);
    assert.equal(respuestaRestablecimiento.body.message, 'Contraseña actualizada correctamente.');
    assert.equal(usuario.actualizaciones.length, usuarioActualizacionesIniciales + 1);
    assert.equal(tokenGuardado.usado, true);

    const respuestaReutilizado = crearRespuesta();
    await resetPassword({ body: { token, currentPassword: 'NewPass123!', password: 'OtherPass456!' } }, respuestaReutilizado);
    assert.equal(respuestaReutilizado.statusCode, 400);
    assert.equal(usuario.actualizaciones.length, usuarioActualizacionesIniciales + 1);

    const cantidadCambios = usuario.actualizaciones.length;
    const respuestaPasswordIncorrecta = crearRespuesta();
    await changePassword({
      user: { id: usuario.id },
      body: { currentPassword: 'Incorrecta123!', newPassword: 'Nueva123!' },
    }, respuestaPasswordIncorrecta);
    assert.equal(respuestaPasswordIncorrecta.statusCode, 400);
    assert.match(respuestaPasswordIncorrecta.body.error, /contraseña actual es incorrecta/);
    assert.equal(usuario.actualizaciones.length, cantidadCambios);

    const respuestaMismaPassword = crearRespuesta();
    await changePassword({
      user: { id: usuario.id },
      body: { currentPassword: 'NewPass123!', newPassword: 'NewPass123!' },
    }, respuestaMismaPassword);
    assert.equal(respuestaMismaPassword.statusCode, 400);
    assert.match(respuestaMismaPassword.body.error, /debe ser diferente/);
    assert.equal(usuario.actualizaciones.length, cantidadCambios);

    const respuestaNuevaPassword = crearRespuesta();
    await changePassword({
      user: { id: usuario.id },
      body: { currentPassword: 'NewPass123!', newPassword: 'DifferentPass456!' },
    }, respuestaNuevaPassword);
    assert.equal(respuestaNuevaPassword.statusCode, 200);
    assert.equal(usuario.actualizaciones.length, cantidadCambios + 1);
    assert.equal(await bcrypt.compare('DifferentPass456!', usuario.password_hash), true);
  } finally {
    models.Usuario.findOne = originales.findOneUsuario;
    models.Usuario.findByPk = originales.findByPkUsuario;
    models.TokenRecuperacion.update = originales.updateToken;
    models.TokenRecuperacion.create = originales.createToken;
    models.TokenRecuperacion.findOne = originales.findOneToken;
  }
});
