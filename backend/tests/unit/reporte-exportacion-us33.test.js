
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const carpetaSrc = path.resolve(__dirname, '../../src');

// Simular dependencias sin conectar a la base de datos.
function simularModulo(rutaRelativa, contenido) {
  const ruta = require.resolve(
    path.join(carpetaSrc, rutaRelativa)
  );

  require.cache[ruta] = {
    id: ruta,
    filename: ruta,
    loaded: true,
    exports: contenido
  };
}

// Simular inventario vacío.
simularModulo('models', {
  Producto: {
    sequelize: {
      models: {
        Categoria: {}
      }
    },
    findAll: async () => []
  },

  Lote: {},

  Alerta: {
    findAll: async () => []
  }
});

// Las predicciones no deben consultarse
// cuando no existen productos.
simularModulo('services/prediccionDemandaService', {
  predecirProductos: async () => {
    throw new Error(
      'No se deben generar predicciones sin productos.'
    );
  }
});

// No se deben generar archivos si no hay datos.
simularModulo('services/exportacionReporteService', {
  generarPDF: async () => {
    throw new Error(
      'No debe generarse un PDF sin información.'
    );
  },

  generarExcel: () => {
    throw new Error(
      'No debe generarse un Excel sin información.'
    );
  }
});

const {
  exportarReporte
} = require('../../src/controllers/reporteExportacionController');

// Crear una respuesta simulada de Express.
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
    },

    setHeader() {
      return this;
    },

    send(datos) {
      this.cuerpo = datos;
      return this;
    }
  };
}

// Ejecutar el controlador sin levantar el servidor.
async function ejecutarPrueba(query) {
  const req = { query };
  const res = crearRespuesta();

  let errorRecibido = null;

  await exportarReporte(req, res, (error) => {
    errorRecibido = error;
  });

  assert.equal(
    errorRecibido,
    null,
    'El controlador no debe producir errores inesperados.'
  );

  return res;
}

// PRUEBA 1: Sin datos para PDF.
test('US-33: PDF sin datos disponibles', async () => {
  const respuesta = await ejecutarPrueba({
    formato: 'pdf',
    dias: '7'
  });

  assert.equal(respuesta.statusCode, 404);

  assert.deepEqual(respuesta.cuerpo, {
    error: 'No hay datos disponibles para exportar.'
  });
});

// PRUEBA 2: Sin datos para Excel.
test('US-33: Excel sin datos disponibles', async () => {
  const respuesta = await ejecutarPrueba({
    formato: 'excel',
    dias: '14'
  });

  assert.equal(respuesta.statusCode, 404);

  assert.deepEqual(respuesta.cuerpo, {
    error: 'No hay datos disponibles para exportar.'
  });
});

// PRUEBA 3: Formato incorrecto.
test('US-33: Rechazar formato no permitido', async () => {
  const respuesta = await ejecutarPrueba({
    formato: 'word',
    dias: '7'
  });

  assert.equal(respuesta.statusCode, 400);

  assert.deepEqual(respuesta.cuerpo, {
    error: 'Selecciona PDF o Excel.'
  });
});

// PRUEBA 4: Periodo incorrecto.
test('US-33: Rechazar periodo no permitido', async () => {
  const respuesta = await ejecutarPrueba({
    formato: 'pdf',
    dias: '100'
  });

  assert.equal(respuesta.statusCode, 400);

  assert.deepEqual(respuesta.cuerpo, {
    error: 'Selecciona 7, 14 o 30 días.'
  });
});
