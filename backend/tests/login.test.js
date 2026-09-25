const test = require('node:test');
const assert = require('node:assert/strict');

const { Usuario } = require('../src/models');
const { login } = require('../src/services/authService');
const { UsuarioDto } = require('../src/dtos/usuarioDto');

const usuarioOriginal = Usuario.findOne;

test.afterEach(() => {
  Usuario.findOne = usuarioOriginal;
});

test('login autentica un usuario y devuelve tokens y permisos', async () => {
  const consultas = [];
  const usuario = {
    id: 7,
    nombre: 'Ana',
    email: 'ana@demo.test',
    rol_id: 2,
    activo: true,
    is_staff: false,
    rol: { nombre: 'Encargado de Inventario', permisos: [{ codigo: 'gestionar_productos' }] },
    validarPassword: async (password) => password === 'correcta',
    save: async () => {},
  };

  Usuario.findOne = async ({ where }) => {
    consultas.push(where);
    return usuario;
  };

  const resultado = await login('ana@demo.test', 'correcta');

  assert.deepEqual(consultas, [{ email: 'ana@demo.test' }]);
  assert.equal(resultado.usuario.email, 'ana@demo.test');
  assert.deepEqual(resultado.usuario.permisos, ['gestionar_productos']);
  assert.equal(typeof resultado.token, 'string');
  assert.equal(typeof resultado.refreshToken, 'string');
});

test('login rechaza un usuario inexistente o una contraseña incorrecta', async () => {
  Usuario.findOne = async () => null;
  await assert.rejects(() => login('nadie@demo.test', 'cualquiera'), /Credenciales incorrectas/);

  Usuario.findOne = async () => ({
    activo: true,
    validarPassword: async () => false,
  });
  await assert.rejects(() => login('ana@demo.test', 'incorrecta'), /Correo o contraseña incorrectos/);
});

test('UsuarioDto tolera un usuario Google sin rol cargado', () => {
  const usuario = UsuarioDto.fromModel({
    id: 9,
    nombre: 'Usuario Google',
    email: 'google@demo.test',
    rol: null,
    activo: true,
  });

  assert.equal(usuario.nombre, 'Usuario Google');
  assert.equal(usuario.rol, null);
  assert.equal(usuario.rol_nombre, null);
  assert.deepEqual(usuario.permisos, []);
});