const test = require('node:test');
const assert = require('node:assert');
const { cumplePoliticaPassword } = require('../../src/utils/passwordPolicy');

// Prueba: passwordPolicy valid.
test('passwordPolicy valid', () => {
  assert.equal(cumplePoliticaPassword('Abcdef1!'), true);
});
// Prueba: passwordPolicy invalid.
test('passwordPolicy invalid', () => {
  assert.equal(cumplePoliticaPassword('abc'), false);
});
