const cumplePoliticaPassword = (password) => (
  typeof password === 'string'
  && password.length >= 8
  && /\p{Lu}/u.test(password)
  && /\p{Ll}/u.test(password)
  && /\p{N}/u.test(password)
  && /[^\p{L}\p{N}\s]/u.test(password)
);

module.exports = { cumplePoliticaPassword };