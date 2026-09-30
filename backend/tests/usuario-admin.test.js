const test = require('node:test');
const assert = require('node:assert/strict');

const { Usuario, Rol } = require('../src/models');
const config = require('../src/config');
const { crear } = require('../src/controllers/usuarioController');
const { verificarAdministrador } = require('../src/middleware/permission');

const originales = {
  findByPk: Usuario.findByPk,
  findOne: Usuario.findOne,
  create: Usuario.create,
  rolFindByPk: Rol.findByPk,
  secreto: config.USER_CREATION_SECRET,
};

test.afterEach(() => {
  Usuario.findByPk = originales.findByPk;
  Usuario.findOne = originales.findOne;
  Usuario.create = originales.create;
  Rol.findByPk = originales.rolFindByPk;
  config.USER_CREATION_SECRET = originales.secreto;
});

function crearRespuesta() {
  return {
    statusCode: 200,
    body: null,
    status(codigo) {
      this.statusCode = codigo;
      return this;
    },
    json(cuerpo) {
      this.body = cuerpo;
      return this;
    },
  };
}

test('solo el rol Administrador puede gestionar usuarios', async () => {
  Usuario.findByPk = async () => ({ rol: { nombre: 'Encargado de Inventario' } });
  const respuesta = crearRespuesta();
  let avanzo = false;

  await verificarAdministrador({ user: { id: 4 } }, respuesta, () => { avanzo = true; });

  assert.equal(respuesta.statusCode, 403);
  assert.equal(avanzo, false);
});

test('el alta rechaza una clave secreta incorrecta', async () => {
  config.USER_CREATION_SECRET = 'secreto-configurado';
  const respuesta = crearRespuesta();

  await crear({ body: { clave_secreta: 'secreto-incorrecto' } }, respuesta, assert.fail);

  assert.equal(respuesta.statusCode, 403);
  assert.equal(respuesta.body.error, 'Clave secreta incorrecta');
});

test('el alta con clave válida persiste únicamente los datos del empleado', async () => {
  config.USER_CREATION_SECRET = 'secreto-configurado';
  Rol.findByPk = async (id) => ({ id });
  Usuario.findOne = async () => null;
  let datosPersistidos;
  Usuario.create = async (datos) => {
    datosPersistidos = datos;
    return { id: 15, ...datos };
  };
  const respuesta = crearRespuesta();

  await crear({
    body: {
      nombres: 'Ana',
      apellidos: 'García',
      dni: '12345678',
      email: 'ANA@EMPRESA.TEST',
      password: 'Clave-temporal-7',
      rol_id: '3',
      clave_secreta: 'secreto-configurado',
    },
  }, respuesta, assert.fail);

  assert.equal(respuesta.statusCode, 201);
  assert.equal(datosPersistidos.nombres, 'Ana');
  assert.equal(datosPersistidos.apellidos, 'García');
  assert.equal(datosPersistidos.dni, '12345678');
  assert.equal(datosPersistidos.email, 'ana@empresa.test');
  assert.equal(datosPersistidos.rol_id, 3);
  assert.equal('clave_secreta' in datosPersistidos, false);
});

test('el alta rechaza contraseña que incumple la política', async () => {
  config.USER_CREATION_SECRET = 'secreto-configurado';
  Rol.findByPk = async (id) => ({ id });
  Usuario.findOne = async () => null;
  const respuesta = crearRespuesta();

  await crear({
    body: {
      nombres: 'Prueba',
      apellidos: 'Contraseña',
      dni: '99999999',
      email: 'prueba.password@test.com',
      password: 'clave12345',
      rol_id: '3',
      clave_secreta: 'secreto-configurado',
    },
  }, respuesta, assert.fail);

  assert.equal(respuesta.statusCode, 400);
  assert.equal(respuesta.body.error, 'La contraseña debe tener al menos 8 caracteres, mayúscula, minúscula, número y símbolo');
});