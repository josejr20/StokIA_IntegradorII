const test = require('node:test');
const assert = require('node:assert/strict');

const config = require('../src/config');
const { authRateLimit } = require('../src/middleware/rateLimit');

const windowOriginal = config.AUTH_RATE_LIMIT_WINDOW_MS;
const maxOriginal = config.AUTH_RATE_LIMIT_MAX;

test.after(() => {
  config.AUTH_RATE_LIMIT_WINDOW_MS = windowOriginal;
  config.AUTH_RATE_LIMIT_MAX = maxOriginal;
});

test('429 incluye el tiempo restante y el header Retry-After', () => {
  config.AUTH_RATE_LIMIT_WINDOW_MS = 60_000;
  config.AUTH_RATE_LIMIT_MAX = 1;
  const req = { ip: 'test-rate-limit', path: `/auth/login-${Date.now()}` };
  let statusCode = 200;
  let body;
  const headers = {};
  const res = {
    setHeader: (name, value) => { headers[name] = value; },
    status: (value) => {
      statusCode = value;
      return res;
    },
    json: (value) => {
      body = value;
      return res;
    },
  };

  authRateLimit(req, res, () => {});
  authRateLimit(req, res, () => assert.fail('La solicitud bloqueada no debe continuar'));

  assert.equal(statusCode, 429);
  assert.equal(body.error, 'Demasiadas solicitudes. Intenta nuevamente más tarde.');
  assert.ok(body.retryAfterMs > 0 && body.retryAfterMs <= config.AUTH_RATE_LIMIT_WINDOW_MS);
  assert.equal(headers['Retry-After'], String(Math.ceil(body.retryAfterMs / 1000)));
});
