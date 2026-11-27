'use strict';

// HU-178 (US-35) | QA-01: validaciones del panel de administración de usuarios.
// Servicio y controlador se prueban con modelos simulados: no se conecta a ninguna base de datos.

const test = require('node:test');
const assert = require('node:assert/strict');

// ---------- Datos simulados ----------
const ROL_ADMIN = { id: 1, nombre: 'Administrador' };
const ROL_VENTAS = { id: 2, nombre: 'Ventas' };
const ROLES = [ROL_ADMIN, ROL_VENTAS];

let usuarios = [];
let administradoresActivos = 2;

function reiniciar() {
  usuarios = [
    { id: 1, nombres: 'Ana', apellidos: 'Admin', dni: '11111111', email: 'ana@stockia.pe', rol_id: 1, rol: ROL_ADMIN, activo: true },
    { id: 2, nombres: 'Luis', apellidos: 'Ventas', dni: '22222222', email: 'luis@stockia.pe', rol_id: 2, rol: ROL_VENTAS, activo: true },
    { id: 3, nombres: 'Rosa', apellidos: 'Caja', dni: '33333333', email: 'rosa@stockia.pe', rol_id: 2, rol: ROL_VENTAS, activo: false },
  ];
  administradoresActivos = 2;
}

const repositorio = {
  buscarPorEmail: async (email) => usuarios.find((u) => u.email === email) || null,
  buscarPorDni: async (dni) => usuarios.find((u) => u.dni === dni) || null,
  buscarRol: async (id) => ROLES.find((r) => r.id === id) || null,
  contarAdministradoresActivos: async () => administradoresActivos,
};

const { prepararEdicion, validarDesactivacion, ErrorUsuario } = require('../src/services/usuarioAdminService');

const usuario = (id) => usuarios.find((u) => u.id === id);
const editar = (id, cuerpo, solicitanteId = 1) =>
  prepararEdicion({ cuerpo, usuario: usuario(id), solicitanteId, repositorio });

async function rechaza(promesa, status, mensaje) {
  await assert.rejects(promesa, (error) => {
    assert.ok(error instanceof ErrorUsuario, 'debe ser un ErrorUsuario');
    assert.equal(error.status, status);
    assert.match(error.message, mensaje);
    return true;
  });
}

test.beforeEach(reiniciar);

// ---------- Servicio: edición ----------
test('TC-03: editar normaliza los datos y devuelve solo lo que se puede guardar', async () => {
  const datos = await editar(2, { nombres: '  Luis Alberto ', email: '  LUIS.A@Stockia.PE ', dni: ' 44444444 ', rol_id: 2, es_staff: true });

  assert.deepEqual(datos, { nombres: 'Luis Alberto', email: 'luis.a@stockia.pe', dni: '44444444' });
  assert.equal('es_staff' in datos, false);
});

test('TC-05: rechaza un correo que ya usa otro usuario', async () => {
  await rechaza(editar(2, { email: 'ana@stockia.pe' }), 409, /correo ya está registrado/);
});

test('TC-05: el correo diferente solo por mayúsculas también se detecta como duplicado', async () => {
  await rechaza(editar(2, { email: 'ANA@stockia.pe' }), 409, /correo ya está registrado/);
});

test('TC-05: permite guardar el mismo correo del propio usuario', async () => {
  const datos = await editar(2, { email: 'luis@stockia.pe' });
  assert.equal(datos.email, 'luis@stockia.pe');
});

test('rechaza un DNI que ya usa otro usuario', async () => {
  await rechaza(editar(2, { dni: '11111111' }), 409, /DNI ya está registrado/);
});

test('rechaza correo con formato inválido y nombres demasiado cortos', async () => {
  await rechaza(editar(2, { email: 'sin-arroba' }), 400, /correo válido/);
  await rechaza(editar(2, { nombres: 'A' }), 400, /nombres/);
  await rechaza(editar(2, { apellidos: ' ' }), 400, /apellidos/);
});

test('TC-04: asignar un rol que no existe se rechaza', async () => {
  await rechaza(editar(2, { rol_id: 99 }), 400, /rol válido/);
  await rechaza(editar(2, { rol_id: 'abc' }), 400, /rol válido/);
});

test('TC-04: cambiar el rol de un usuario lo incluye en los cambios', async () => {
  const datos = await editar(2, { rol_id: 1 });
  assert.deepEqual(datos, { rol_id: 1 });
});

test('la contraseña nueva debe cumplir la política y vacía significa no cambiarla', async () => {
  await rechaza(editar(2, { password: 'debil' }), 400, /contraseña debe tener/);
  assert.deepEqual(await editar(2, { password: '' }), {});
  assert.deepEqual(await editar(2, { password: 'Segura#2026' }), { password_hash: 'Segura#2026' });
});

// ---------- Servicio: desactivación y administradores ----------
test('un administrador no puede desactivar su propio usuario', async () => {
  await rechaza(validarDesactivacion({ usuario: usuario(1), solicitanteId: 1, repositorio }), 400, /propio usuario/);
});

test('no se puede desactivar al último administrador activo', async () => {
  administradoresActivos = 1;
  await rechaza(validarDesactivacion({ usuario: usuario(1), solicitanteId: 2, repositorio }), 400, /al menos un administrador/);
});

test('se puede desactivar a un administrador si queda otro activo', async () => {
  administradoresActivos = 2;
  await validarDesactivacion({ usuario: usuario(1), solicitanteId: 2, repositorio });
});

test('se puede desactivar a un usuario que no es administrador', async () => {
  administradoresActivos = 1;
  await validarDesactivacion({ usuario: usuario(2), solicitanteId: 1, repositorio });
});

test('no se puede quitar el rol de administrador al último administrador activo', async () => {
  administradoresActivos = 1;
  await rechaza(editar(1, { rol_id: 2 }, 2), 400, /al menos un administrador/);
});

test('desactivar por la vía de editar aplica las mismas protecciones', async () => {
  await rechaza(editar(1, { activo: false }, 1), 400, /propio usuario/);
  assert.deepEqual(await editar(2, { activo: false }, 1), { activo: false });
  await rechaza(editar(2, { activo: 'no' }, 1), 400, /estado del usuario/);
});

test('reactivar un usuario inactivo se permite', async () => {
  assert.deepEqual(await editar(3, { activo: true }), { activo: true });
});

// ---------- Controlador ----------
function simularModulo(ruta, exportaciones) {
  const archivo = require.resolve(ruta);
  require.cache[archivo] = { id: archivo, filename: archivo, loaded: true, exports: exportaciones };
  return archivo;
}

const actualizaciones = [];
function usuarioConMetodos(datos) {
  return {
    ...datos,
    update: async function actualizarDatos(cambios) { actualizaciones.push(cambios); Object.assign(this, cambios); },
    save: async function guardar() { actualizaciones.push({ guardado: true, activo: this.activo }); },
    toJSON() { const { update, save, toJSON, ...resto } = this; return resto; },
  };
}

const modelosFalsos = {
  Usuario: {
    sequelize: { models: { Rol: {} } },
    findByPk: async (id) => {
      const base = usuarios.find((u) => u.id === Number(id));
      return base ? usuarioConMetodos(base) : null;
    },
    findOne: async () => null,
    count: async () => administradoresActivos,
  },
  Rol: { findByPk: async (id) => ROLES.find((r) => r.id === Number(id)) || null },
};

const archivosSimulados = [
  simularModulo('../src/models', modelosFalsos),
  simularModulo('../src/config', { USER_CREATION_SECRET: 'secreto' }),
];
const { actualizar, desactivar } = require('../src/controllers/usuarioController');

test.after(() => {
  for (const archivo of archivosSimulados) delete require.cache[archivo];
});

function respuesta() {
  const res = { codigo: 200, cuerpo: null };
  res.status = (codigo) => { res.codigo = codigo; return res; };
  res.json = (cuerpo) => { res.cuerpo = cuerpo; return res; };
  return res;
}
const siguiente = (error) => { throw error; };

test('TC-07: actualizar confirma la operación con un mensaje', async () => {
  actualizaciones.length = 0;
  const res = respuesta();

  await actualizar({ params: { id: 2 }, body: { nombres: 'Luis Alberto' }, user: { id: 1 } }, res, siguiente);

  assert.equal(res.codigo, 200);
  assert.equal(res.cuerpo.message, 'Usuario actualizado correctamente');
  assert.deepEqual(actualizaciones, [{ nombres: 'Luis Alberto' }]);
});

test('TC-02: actualizar devuelve 409 con el error cuando el correo ya existe', async () => {
  const antes = actualizaciones.length;
  modelosFalsos.Usuario.findOne = async ({ where }) => usuarios.find((u) => u.email === where.email) || null;
  const res = respuesta();

  await actualizar({ params: { id: 2 }, body: { email: 'ana@stockia.pe' }, user: { id: 1 } }, res, siguiente);

  assert.equal(res.codigo, 409);
  assert.match(res.cuerpo.error, /correo ya está registrado/);
  assert.equal(actualizaciones.length, antes, 'no debe guardarse nada');
});

test('actualizar responde 404 si el usuario no existe y 400 si no hay cambios', async () => {
  const noExiste = respuesta();
  await actualizar({ params: { id: 99 }, body: { nombres: 'Zoe' }, user: { id: 1 } }, noExiste, siguiente);
  assert.equal(noExiste.codigo, 404);

  const sinCambios = respuesta();
  await actualizar({ params: { id: 2 }, body: {}, user: { id: 1 } }, sinCambios, siguiente);
  assert.equal(sinCambios.codigo, 400);
});

test('TC-07: desactivar confirma la operación y marca al usuario como inactivo', async () => {
  actualizaciones.length = 0;
  const res = respuesta();

  await desactivar({ params: { id: 2 }, user: { id: 1 } }, res, siguiente);

  assert.equal(res.codigo, 200);
  assert.equal(res.cuerpo.message, 'Usuario desactivado correctamente');
  assert.deepEqual(actualizaciones, [{ guardado: true, activo: false }]);
});

test('desactivar rechaza que un administrador se desactive a sí mismo', async () => {
  actualizaciones.length = 0;
  const res = respuesta();

  await desactivar({ params: { id: 1 }, user: { id: 1 } }, res, siguiente);

  assert.equal(res.codigo, 400);
  assert.match(res.cuerpo.error, /propio usuario/);
  assert.equal(actualizaciones.length, 0);
});