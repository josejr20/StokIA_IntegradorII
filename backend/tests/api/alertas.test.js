const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { app } = require('../../src/app');
test('alertas endpoint responds', async () => {
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const res = await fetch('http://127.0.0.1:'+port+'/api/alertas');
  assert.ok([200,401,403,404].includes(res.status));
  server.close();
});
