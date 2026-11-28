
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { after } = require('node:test');

// Rutas de los modulos que vamos a simular
const rutaModelos = require.resolve('../../src/models');
const rutaLogger = require.resolve('../../src/utils/logger');
const rutaPermisos = require.resolve('../../src/middleware/permission');

// Guardar las referencias originales
const rutas = [
  rutaModelos,
  rutaLogger,
  rutaPermisos
];

const originales = new Map(
  rutas.map((ruta) => [ruta, require.cache[ruta]])
);

// Simular un usuario sin consultar PostgreSQL
let usuarioActual = null;

const UsuarioSimulado = {
  sequelize: {
    models: {
      Rol: {}
    }
  },

  findByPk: async () => usuarioActual
};

// Simular el registro de mensajes
const loggerSimulado = {
  warn: () => {},
  error: () => {}
};

// Reemplazar dependencias solamente durante esta prueba
function simularModulo(ruta, contenido) {
  require.cache[ruta] = {
    id: ruta,
    filename: ruta,
    loaded: true,
    exports: contenido
  };
}

simularModulo(rutaModelos, {
  Usuario: UsuarioSimulado
});

simularModulo(rutaLogger, loggerSimulado);

// Cargar middleware usando las dependencias simuladas
delete require.cache[rutaPermisos];

const {
  verificarPermiso
} = require('../../src/middleware/permission');

// Restaurar las referencias al terminar
after(() => {
  for (const [ruta, original] of originales) {
    if (original) {
      require.cache[ruta] = original;
    } else {
      delete require.cache[ruta];
    }
  }
});

// Crear usuario ficticio para cada prueba
function crearUsuario(permisos, opciones = {}) {
  return {
    id: 1,
    email: 'usuario-prueba@example.test',
    is_staff: opciones.is_staff || false,
    is_superuser: opciones.is_superuser || false,

    rol: {
      getPermisos: async () =>
        permisos.map((codigo) => ({ codigo }))
    }
  };
}

// Crear respuesta simulada de Express
function crearRespuesta() {
  return {
    statusCode: 200,
    cuerpo: null,

    status(codigo) {
      this.statusCode = codigo;
      return this;
    },

    json(datos) {
      this.cuerpo = datos;
      return this;
    }
  };
}

// Ejecutar verificacion de permisos
async function comprobarPermiso() {
  const req = {
    user: {
      id: 1
    }
  };

  const res = crearRespuesta();

  let accesoPermitido = false;

  const siguiente = () => {
    accesoPermitido = true;
  };

  await verificarPermiso('generar_reportes')(
    req,
    res,
    siguiente
  );

  return {
    respuesta: res,
    accesoPermitido
  };
}

// PRUEBA 1
test('US-33: Usuario sin permiso no puede exportar', async () => {
  usuarioActual = crearUsuario(['ver_kpis']);

  const resultado = await comprobarPermiso();

  assert.equal(resultado.respuesta.statusCode, 403);
  assert.equal(resultado.accesoPermitido, false);
});

// PRUEBA 2
test('US-33: Usuario con permiso puede exportar', async () => {
  usuarioActual = crearUsuario([
    'ver_kpis',
    'generar_reportes'
  ]);

  const resultado = await comprobarPermiso();

  assert.equal(resultado.accesoPermitido, true);
});

// PRUEBA 3
test('US-33: Usuario administrador tecnico puede continuar', async () => {
  usuarioActual = crearUsuario([], {
    is_staff: true
  });

  const resultado = await comprobarPermiso();

  assert.equal(resultado.accesoPermitido, true);
});

// PRUEBA 4
test('US-33: Usuario inexistente es rechazado', async () => {
  usuarioActual = null;

  const resultado = await comprobarPermiso();

  assert.equal(resultado.respuesta.statusCode, 403);
  assert.equal(resultado.accesoPermitido, false);

  assert.equal(
    resultado.respuesta.cuerpo.error,
    'Usuario no encontrado'
  );
});

// PRUEBA 5
test('US-33: Usuario sin rol es rechazado', async () => {
  usuarioActual = crearUsuario([]);
  usuarioActual.rol = null;

  const resultado = await comprobarPermiso();

  assert.equal(resultado.respuesta.statusCode, 403);
  assert.equal(resultado.accesoPermitido, false);

  assert.equal(
    resultado.respuesta.cuerpo.error,
    'Usuario sin rol asignado'
  );
});
