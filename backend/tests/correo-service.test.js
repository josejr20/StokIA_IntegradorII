'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../src/config');
const nodemailer = require('nodemailer');

const servicePath = require.resolve('../src/services/correoService');

function cargarServicioNuevo() {
  delete require.cache[servicePath];
  return require(servicePath);
}

test('enviarCorreo usa exclusivamente SMTP con los valores configurados', async () => {
  const originales = {
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    user: config.SMTP_USER,
    password: config.SMTP_PASSWORD,
    from: config.EMAIL_FROM,
    createTransport: nodemailer.createTransport,
  };
  let opcionesTransportador;
  let mensajeEnviado;

  try {
    config.SMTP_HOST = 'smtp.example.com';
    config.SMTP_PORT = 465;
    config.SMTP_USER = 'smtp-user@example.com';
    config.SMTP_PASSWORD = 'smtp-password';
    config.EMAIL_FROM = 'stockia@example.com';
    nodemailer.createTransport = (opciones) => {
      opcionesTransportador = opciones;
      return { sendMail: async (mensaje) => { mensajeEnviado = mensaje; } };
    };

    const { enviarCorreo } = cargarServicioNuevo();
    assert.equal(await enviarCorreo('destino@example.com', 'Asunto', '<p>Contenido</p>'), true);
    assert.deepEqual(opcionesTransportador, {
      host: 'smtp.example.com',
      port: 465,
      secure: true,
      auth: { user: 'smtp-user@example.com', pass: 'smtp-password' },
    });
    assert.deepEqual(mensajeEnviado, {
      from: 'stockia@example.com',
      to: 'destino@example.com',
      subject: 'Asunto',
      html: '<p>Contenido</p>',
    });
  } finally {
    config.SMTP_HOST = originales.host;
    config.SMTP_PORT = originales.port;
    config.SMTP_USER = originales.user;
    config.SMTP_PASSWORD = originales.password;
    config.EMAIL_FROM = originales.from;
    nodemailer.createTransport = originales.createTransport;
    delete require.cache[servicePath];
  }
});

test('enviarCorreo falla explícitamente si falta configuración SMTP', async () => {
  const originales = {
    host: config.SMTP_HOST,
    user: config.SMTP_USER,
    password: config.SMTP_PASSWORD,
  };

  try {
    config.SMTP_HOST = '';
    config.SMTP_USER = '';
    config.SMTP_PASSWORD = '';
    const { enviarCorreo } = cargarServicioNuevo();
    await assert.rejects(enviarCorreo('destino@example.com', 'Asunto', '<p>Contenido</p>'), {
      message: 'La configuración SMTP está incompleta',
    });
  } finally {
    config.SMTP_HOST = originales.host;
    config.SMTP_USER = originales.user;
    config.SMTP_PASSWORD = originales.password;
    delete require.cache[servicePath];
  }
});
