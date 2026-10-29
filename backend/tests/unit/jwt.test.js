const test = require('node:test');
const assert = require('node:assert');
const { generarToken, verificarToken } = require('../../src/utils/jwt');

test('jwt generate/verify', () => {
  const t = generarToken({ id: 1, email: 'a@b.com', rol_id: 1 });
  const d = verificarToken(t);
  assert.equal(d.id, 1);
});
