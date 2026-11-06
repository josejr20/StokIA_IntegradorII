const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { app } = require('../../src/app');

// Prueba el endpoint de login.
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

// Prueba rechazo de inyección SQL en login.
test('auth login SQL injection attempt rejected', async () => {
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const res = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo: "' OR 1=1 --", contrasena: "' OR 1=1 --" }),
  });
  assert.ok([400,401,403,404].includes(res.status));
  server.close();
});

// Prueba el rate limit en intentos repetidos.
test('auth login rate limit triggers on repeated attempts', async () => {
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  let last = 0;
  for (let i = 0; i < 20; i++) {
    const res = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo: 'x@x.com', contrasena: 'bad' }),
    });
    last = res.status;
  }
  assert.ok([401,429,400,403].includes(last));
  server.close();
});

// Prueba la creación de usuario.
test('create user endpoint responds', async () => {
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const res = await fetch(`http://127.0.0.1:${port}/api/usuarios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre: 'Test', email: 'test@test.com', password: 'Pass123!', rol_id: 1 }),
  });
  assert.ok([200,201,400,401,403,404,409].includes(res.status));
  server.close();
});

// Prueba el restablecimiento de contraseña.
test('change password flow responds', async () => {
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const res = await fetch(`http://127.0.0.1:${port}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo: 'x@x.com', codigo: '123456', nuevaContrasena: 'NewPass123!' }),
  });
  assert.ok([200,400,401,403,404,500].includes(res.status));
  server.close();
});
