const test = require('node:test');
const assert = require('node:assert');
const { cumplePoliticaPassword } = require('../../src/utils/passwordPolicy');

test('passwordPolicy valid', () => {
  assert.equal(cumplePoliticaPassword('Abcdef1!'), true);
});
test('passwordPolicy invalid', () => {
  assert.equal(cumplePoliticaPassword('abc'), false);
});
