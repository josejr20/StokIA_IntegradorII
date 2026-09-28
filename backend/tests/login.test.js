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

test('login autentica por correo o nombres', async () => {
  const consultas = [];
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
    consultas.push(consulta);
    return [usuario];
  };

  const resultados = await Promise.all([
    login('ana@demo.test', 'correcta'),
    login('Ana', 'correcta'),
  ]);

  assert.equal(consultas.length, 2);
  for (const consulta of consultas) {
    assert.equal(consulta.where[Op.or].length, 2);
    assert.equal(consulta.limit, 2);
  }
  for (const resultado of resultados) {
    assert.equal(resultado.usuario.email, 'ana@demo.test');
    assert.deepEqual(resultado.usuario.permisos, ['gestionar_productos']);
    assert.equal(typeof resultado.token, 'string');
    assert.equal(typeof resultado.refreshToken, 'string');
  }
});

test('login rechaza identificadores inexistentes, ambiguos o una contraseña incorrecta', async () => {
  Usuario.findAll = async () => [];
  await assert.rejects(() => login('nadie@demo.test', 'cualquiera'), /Credenciales incorrectas/);

  Usuario.findAll = async () => [{
    activo: true,
    validarPassword: async () => false,
  }];
  await assert.rejects(() => login('ana@demo.test', 'incorrecta'), /Correo o contraseña incorrectos/);

  Usuario.findAll = async () => [{}, {}];
  await assert.rejects(() => login('Ana', 'cualquiera'), /Credenciales incorrectas/);
});

test('UsuarioDto tolera un usuario Google sin rol cargado', () => {
  const usuario = UsuarioDto.fromModel({
    id: 9,
    nombres: 'Usuario Google',
    apellidos: 'Google',
    dni: null,
    email: 'google@demo.test',
    rol: null,
    activo: true,
  });

  assert.equal(usuario.nombres, 'Usuario Google');
  assert.equal(usuario.rol, null);
  assert.equal(usuario.rol_nombre, null);
  assert.deepEqual(usuario.permisos, []);
});