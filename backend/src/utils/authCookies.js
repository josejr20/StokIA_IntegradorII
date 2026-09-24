const config = require('../config');

const duracionEnMilisegundos = (valor, fallback) => {
  const coincidencia = String(valor).match(/^(\d+)\s*(s|m|h|d)$/i);
  if (!coincidencia) return fallback;
  const unidades = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
  return Number(coincidencia[1]) * unidades[coincidencia[2].toLowerCase()];
};

const ACCESS_MAX_AGE = duracionEnMilisegundos(config.JWT_EXPIRES_IN, 8 * 60 * 60 * 1000);
const REFRESH_MAX_AGE = duracionEnMilisegundos(config.JWT_REFRESH_EXPIRES_IN, 7 * 24 * 60 * 60 * 1000);

const cookieOptions = (maxAge) => ({
  httpOnly: true,
  secure: config.COOKIE_SECURE,
  sameSite: config.COOKIE_SAME_SITE,
  path: '/',
  maxAge,
});

const setAuthCookies = (res, token, refreshToken) => {
  res.cookie('stockia_access', token, cookieOptions(ACCESS_MAX_AGE));
  res.cookie('stockia_refresh', refreshToken, cookieOptions(REFRESH_MAX_AGE));
};

const clearAuthCookies = (res) => {
  const options = cookieOptions();
  res.clearCookie('stockia_access', options);
  res.clearCookie('stockia_refresh', options);
};

const readCookie = (req, name) => {
  const header = req.headers.cookie || '';
  const pair = header.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${name}=`));
  return pair ? decodeURIComponent(pair.slice(name.length + 1)) : null;
};

module.exports = { setAuthCookies, clearAuthCookies, readCookie, ACCESS_MAX_AGE, REFRESH_MAX_AGE };