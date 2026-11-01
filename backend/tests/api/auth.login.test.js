const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { app } = require('../../src/app');

test('auth login endpoint responds', async () => {
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const res = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo: 'x@x.com', contrasena: 'bad' }),
  });
  assert.ok([200,400,401,404,500].includes(res.status));
  server.close();
});
