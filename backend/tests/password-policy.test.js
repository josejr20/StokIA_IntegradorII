const test = require('node:test');
const assert = require('node:assert/strict');
const { cumplePoliticaPassword } = require('../src/utils/passwordPolicy');

test('acepta contraseñas que cumplen todos los factores', () => {
  assert.equal(cumplePoliticaPassword('Segura123!'), true);
  assert.equal(cumplePoliticaPassword('Árbol123!'), true);
});

test('rechaza contraseñas que incumplen longitud o algún factor', () => {
  for (const password of ['Aa1!', 'sinmayuscula1!', 'SINMINUSCULA1!', 'SinNumero!!', 'SinSimbolo123']) {
    assert.equal(cumplePoliticaPassword(password), false, password);
  }
  assert.equal(cumplePoliticaPassword(undefined), false);
});