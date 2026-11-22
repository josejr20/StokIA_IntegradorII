'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const authService = require('../../src/services/authService');
const { login } = require('../../src/controllers/authController');

function crearRespuesta() {
  return {
    statusCode: 200,
    body: null,
    cookies: [],
    status(codigo) { this.statusCode = codigo; return this; },
    json(contenido) { this.body = contenido; return this; },
    cookie(...argumentos) { this.cookies.push(argumentos); return this; },
  };
}

test('login uses only the public IP returned by ipify', async () => {
  const fetchOriginal = global.fetch;
  const loginOriginal = authService.login;
  let argumentosLogin;
  global.fetch = async (url, opciones) => {
    assert.equal(url, 'https://api.ipify.org/?format=json');
    assert.ok(opciones.signal);
    return { ok: true, json: async () => ({ ip: '203.0.113.42' }) };
  };
  authService.login = async (...argumentos) => {
    argumentosLogin = argumentos;
    return { usuario: { id: 1 }, token: 'access', refreshToken: 'refresh' };
  };

  try {
    const respuesta = crearRespuesta();
    await login({
      body: { identifier: 'usuario@example.com', password: 'pass', ip_address: '127.0.0.1' },
      headers: {},
      get: () => null,
    }, respuesta);

    assert.equal(argumentosLogin[2], '203.0.113.42');
    assert.equal(respuesta.statusCode, 200);
  } finally {
    global.fetch = fetchOriginal;
    authService.login = loginOriginal;
  }
});

test('login continues without saving a local IP when ipify returns a loopback address', async () => {
  const fetchOriginal = global.fetch;
  const loginOriginal = authService.login;
  let argumentosLogin;
  global.fetch = async () => ({ ok: true, json: async () => ({ ip: '127.0.0.1' }) });
  authService.login = async (...argumentos) => {
    argumentosLogin = argumentos;
    return { usuario: { id: 1 }, token: 'access', refreshToken: 'refresh' };
  };

  try {
    const respuesta = crearRespuesta();
    await login({
      body: { identifier: 'usuario@example.com', password: 'pass' },
      headers: {},
      get: () => null,
    }, respuesta);

    assert.equal(respuesta.statusCode, 200);
    assert.equal(argumentosLogin[2], null);
  } finally {
    global.fetch = fetchOriginal;
    authService.login = loginOriginal;
  }
});

test('login continues without an IP when ipify is unavailable', async () => {
  const fetchOriginal = global.fetch;
  const loginOriginal = authService.login;
  let argumentosLogin;
  global.fetch = async () => { throw new Error('ipify no disponible'); };
  authService.login = async (...argumentos) => {
    argumentosLogin = argumentos;
    return { usuario: { id: 1 }, token: 'access', refreshToken: 'refresh' };
  };

  try {
    const respuesta = crearRespuesta();
    await login({
      body: { identifier: 'usuario@example.com', password: 'pass' },
      headers: {},
      get: () => null,
    }, respuesta);

    assert.equal(respuesta.statusCode, 200);
    assert.equal(argumentosLogin[2], null);
  } finally {
    global.fetch = fetchOriginal;
    authService.login = loginOriginal;
  }
});
