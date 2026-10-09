const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');

const { Usuario } = require('../src/models');
const { login } = require('../src/services/authService');
const { UsuarioDto } = require('../src/dtos/usuarioDto');

const buscarUsuariosOriginal = Usuario.findAll;

test.afterEach(() => {
  Usuario.findAll = buscarUsuariosOriginal;
});

test('login autentica por correo', async () => {
  const usuario = {
    id: 7,
    nombres: 'Ana',
    apellidos: 'García',
    dni: '12345678',
    email: 'ana@demo.test',
    rol_id: 2,
    activo: true,
    is_staff: false,
    rol: { nombre: 'Encargado de Inventario', permisos: [{ codigo: 'gestionar_productos' }] },
    validarPassword: async (password) => password === 'correcta',
    save: async () => {},
  };

  Usuario.findAll = async (consulta) => {
    assert.equal(consulta.where.email, 'ana@demo.test');
    assert.equal(consulta.limit, 2);
    return [usuario];
  };

  const resultado = await login('ana@demo.test', 'correcta');
  assert.equal(resultado.usuario.email, 'ana@demo.test');
  assert.deepEqual(resultado.usuario.permisos, ['gestionar_productos']);
  assert.equal(typeof resultado.token, 'string');
  assert.equal(typeof resultado.refreshToken, 'string');
});

test('login rechaza identificadores inexistentes o una contraseña incorrecta', async () => {
  Usuario.findAll = async () => [];
  await assert.rejects(() => login('nadie@demo.test', 'cualquiera'), /Credenciales incorrectas/);

  Usuario.findAll = async () => [{
    activo: true,
    validarPassword: async () => false,
  }];
  await assert.rejects(() => login('ana@demo.test', 'incorrecta'), /Correo o contraseña incorrectos/);

  Usuario.findAll = async () => [{}, {}];
  await assert.rejects(() => login('ana@demo.test', 'cualquiera'), /Credenciales incorrectas/);
});

test('login rechaza campos vacíos', async () => {
  await assert.rejects(() => login('', 'password'), /Credenciales incorrectas/);
  await assert.rejects(() => login('   ', 'password'), /Credenciales incorrectas/);

  const usuarioConPasswordInvalida = {
    activo: true,
    validarPassword: async () => false,
  };
  Usuario.findAll = async () => [usuarioConPasswordInvalida];
  await assert.rejects(() => login('ana@demo.test', ''), /Correo o contraseña incorrectos/);
  await assert.rejects(() => login('ana@demo.test', '   '), /Correo o contraseña incorrectos/);

  Usuario.findAll = async () => [];
  await assert.rejects(() => login('', ''), /Credenciales incorrectas/);
  await assert.rejects(() => login('   ', '   '), /Credenciales incorrectas/);
});