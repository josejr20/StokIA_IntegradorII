'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  crearContenidoCorreo,
  crearContenidoCorreoStock,
  crearNotificador,
  crearNotificadorStock,
  sincronizarAlertasRiesgo,
} = require('../src/services/notificacionAlertaService');

function crearAlertaRiesgo() {
  return {
    id: 8,
    tipo: 'riesgo_vencimiento',
    producto_id: 4,
    lote_id: 12,
    mensaje: 'Riesgo alto',
    severidad: 'alta',
    fecha_creacion: new Date('2026-11-06T12:00:00Z'),
    datos_origen: {
      codigo: 'P-004',
      nombre: '<Producto>',
      numero_lote: 'L-12',
      fecha_vencimiento: '2026-11-10',
      dias_para_vencer: 4,
      stock: 20,
      demanda_hasta_vencimiento: 5,
      unidades_en_riesgo: 15,
      porcentaje_en_riesgo: 75,
      mensaje: '<script>alert(1)</script>',
      factores: ['Riesgo alto'],
    },
  };
}

test('las plantillas de correo escapan contenido dinámico', () => {
  const correo = crearContenidoCorreo(crearAlertaRiesgo());
  assert.match(correo.asunto, /P-004/);
  assert.match(correo.html, /&lt;Producto&gt;/);
  assert.match(correo.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(correo.html, /<script>/);
});

test('el resumen de stock incluye todos los productos en una sola tabla y correo', async () => {
  const alertas = [
    {
      id: 21,
      producto_id: 4,
      datos_origen: {
        codigo: 'P-004',
        nombre: 'Producto <uno>',
        stock_disponible: 2,
        stock_minimo: 10,
        faltante: 8,
        origen_umbral: 'producto',
      },
    },
    {
      id: 22,
      producto_id: 9,
      datos_origen: {
        codigo: 'P-009',
        nombre: 'Producto dos',
        stock_disponible: 0,
        stock_minimo: 5,
        faltante: 5,
        origen_umbral: 'predeterminado',
      },
    },
  ];
  const notificaciones = [];
  const envios = [];
  const PreferenciaUsuario = {
    findOne: async ({ where }) => {
      assert.deepEqual(where, { usuario_id: 7, clave: 'email_alertas_inventario' });
      return { valor: { activo: true, bajo_stock: true, email: 'bodega@example.com' } };
    },
  };
  const NotificacionCorreo = {
    findOne: async ({ where }) => notificaciones.find((registro) => (
      registro.alerta_id === where.alerta_id && registro.destinatario === where.destinatario
    )) ?? null,
    create: async (datos) => {
      const registro = {
        ...datos,
        update: async function update(cambios) { Object.assign(this, cambios); },
      };
      notificaciones.push(registro);
      return registro;
    },
  };
  const notificar = crearNotificadorStock({
    PreferenciaUsuario,
    NotificacionCorreo,
    enviarCorreo: async (...args) => { envios.push(args); },
  });

  const plantilla = crearContenidoCorreoStock(alertas);
  assert.match(plantilla.asunto, /2 productos/);
  assert.match(plantilla.html, /Código/);
  assert.match(plantilla.html, /Stock disponible/);
  assert.match(plantilla.html, /Stock mínimo/);
  assert.match(plantilla.html, /Faltante/);
  assert.match(plantilla.html, /Origen del mínimo/);
  assert.match(plantilla.html, /Producto &lt;uno&gt;/);
  assert.match(plantilla.html, /P-009/);

  assert.deepEqual(
    await notificar(alertas, 7),
    { destinatarios: 1, enviados: 1, fallidos: 0, motivo: null },
  );
  assert.equal(envios.length, 1);
  assert.equal(envios[0][0], 'bodega@example.com');
  assert.equal(notificaciones.length, 2);
  assert.ok(notificaciones.every((registro) => registro.estado === 'enviado'));
  assert.deepEqual(
    await notificar(alertas, 7),
    { destinatarios: 1, enviados: 0, fallidos: 0, motivo: 'ya_enviado' },
  );
  assert.equal(envios.length, 1);
});

test('notifica solo al usuario autenticado y no duplica envíos completados', async () => {
  const preferencias = [
    { usuario_id: 7, valor: { activo: true, email: 'bodega@example.com', riesgo_vencimiento: true } },
    { usuario_id: 8, valor: { activo: true, email: 'otro@example.com', riesgo_vencimiento: true } },
  ];
  const notificaciones = [];
  const envios = [];
  const consultasPreferencias = [];
  const PreferenciaUsuario = {
    findOne: async ({ where }) => {
      consultasPreferencias.push(where);
      return preferencias.find((preferencia) => preferencia.usuario_id === where.usuario_id) ?? null;
    },
  };
  const NotificacionCorreo = {
    findOne: async ({ where }) => notificaciones.find((fila) => (
      fila.alerta_id === where.alerta_id && fila.destinatario === where.destinatario
    )) ?? null,
    create: async (datos) => {
      const fila = {
        ...datos,
        update: async function update(cambios) { Object.assign(this, cambios); },
      };
      notificaciones.push(fila);
      return fila;
    },
  };
  const enviarCorreo = async (destinatario) => { envios.push(destinatario); };
  const notificar = crearNotificador({ PreferenciaUsuario, NotificacionCorreo, enviarCorreo });

  assert.deepEqual(
    await notificar(crearAlertaRiesgo(), 7),
    { destinatarios: 1, enviados: 1, fallidos: 0, motivo: null },
  );
  assert.deepEqual(
    await notificar(crearAlertaRiesgo(), 7),
    { destinatarios: 1, enviados: 0, fallidos: 0, motivo: 'ya_enviado' },
  );
  assert.deepEqual(envios, ['bodega@example.com']);
  assert.deepEqual(consultasPreferencias, [
    { usuario_id: 7, clave: 'email_alertas_inventario' },
    { usuario_id: 7, clave: 'email_alertas_inventario' },
  ]);
  assert.equal(notificaciones[0].estado, 'enviado');
});

test('no envía correos si no se identifica el usuario de la sesión', async () => {
  let consultas = 0;
  let envios = 0;
  const notificar = crearNotificador({
    PreferenciaUsuario: { findOne: async () => { consultas++; return null; } },
    NotificacionCorreo: {},
    enviarCorreo: async () => { envios++; },
  });

  assert.deepEqual(
    await notificar(crearAlertaRiesgo()),
    { destinatarios: 0, enviados: 0, fallidos: 0, motivo: 'usuario_no_identificado' },
  );
  assert.equal(consultas, 0);
  assert.equal(envios, 0);
});

test('el sincronizador crea y notifica el riesgo una sola vez; actualiza la alerta activa', async () => {
  const alertas = [];
  let notificaciones = 0;
  const Alerta = {
    findAll: async () => alertas.filter((alerta) => ['nueva', 'vista'].includes(alerta.estado)),
    create: async (datos) => {
      const alerta = {
        id: alertas.length + 1,
        ...datos,
        update: async function update(cambios) { Object.assign(this, cambios); },
      };
      alertas.push(alerta);
      return alerta;
    },
  };
  const productos = [{
    producto_id: 4,
    producto: { codigo: 'P-004', nombre: 'Producto' },
    lotes: [{
      lote_id: 12,
      numero_lote: 'L-12',
      fecha_vencimiento: '2026-11-10',
      dias_para_vencer: 4,
      stock: 20,
      estado: 'ok',
      nivel: 'alto',
      mensaje: 'Riesgo alto',
      unidades_en_riesgo: 15,
      porcentaje_en_riesgo: 75,
      demanda_hasta_vencimiento: 5,
      factores: [],
    }],
  }];
  const opciones = {
    Alerta,
    usuarioId: 7,
    notificarAlerta: async (_alerta, usuarioId) => {
      assert.equal(usuarioId, 7);
      notificaciones++;
    },
    logger: { error() {} },
  };

  assert.deepEqual(
    await sincronizarAlertasRiesgo(productos, opciones),
    { creadas: 1, evaluadas: 1 },
  );
  assert.deepEqual(
    await sincronizarAlertasRiesgo(productos, opciones),
    { creadas: 0, evaluadas: 1 },
  );
  assert.equal(alertas.length, 1);
  assert.equal(notificaciones, 1);

  productos[0].lotes[0].nivel = 'bajo';
  await sincronizarAlertasRiesgo(productos, opciones);
  assert.equal(alertas[0].estado, 'atendida');
});
