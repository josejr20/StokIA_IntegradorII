// PASO 1: guardar como backend/src/routes/reniec.routes.js
const express = require('express');
const { QueryTypes } = require('sequelize');
const { sequelizeLocal } = require('../config/database');

const router = express.Router();

// Si tus rutas de clientes usan un middleware de autenticación,
// aplícalo también aquí (son datos personales):
// router.use(requireAuth);

// Mayúsculas, sin tildes (conserva la Ñ), sin signos y con espacios simples.
function normalizar(texto) {
  return String(texto ?? '')
    .toLocaleUpperCase('es-PE')
    .normalize('NFD')
    .replace(/N\u0303/g, '\u00D1')
    .replace(/[\u0300-\u036f]/g, '')
    .normalize('NFC')
    .replace(/[^\p{L}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const COLUMNAS = `
  CASE
    WHEN BTRIM(r.dni::text) ~ '^[0-9]{1,8}$'
      THEN LPAD(BTRIM(r.dni::text), 8, '0')
    ELSE BTRIM(r.dni::text)
  END AS dni,
  r.nombres AS nombres,
  r.ap_pat AS apellido_paterno,
  COALESCE(r.ap_mat, '') AS apellido_materno
`;

// GET /api/reniec/dni/:dni  ->  persona
router.get('/dni/:dni', async (req, res) => {
  const dni = String(req.params.dni || '').trim();

  if (!/^\d{8}$/.test(dni)) {
    return res.status(400).json({ message: 'El DNI debe tener 8 dígitos' });
  }

  try {
    const sinCeros = dni.replace(/^0+/, '') || '0';

    const filas = await sequelizeLocal.query(
      `
      SELECT ${COLUMNAS}
      FROM "public"."reniec_data" r
      WHERE BTRIM(r.dni::text) IN (:dni, :sinCeros)
      LIMIT 1
      `,
      { replacements: { dni, sinCeros }, type: QueryTypes.SELECT }
    );

    if (filas.length === 0) {
      return res
        .status(404)
        .json({ message: 'No se encontró ese DNI en la base RENIEC local' });
    }

    return res.json(filas[0]);
  } catch (error) {
    console.error('Error buscando DNI:', error.message);
    return res.status(500).json({ message: 'No se pudo consultar el DNI' });
  }
});

// GET /api/reniec/buscar?nombres=&apellido_paterno=&apellido_materno=
// ->  lista de personas (máximo 10) con su DNI
router.get('/buscar', async (req, res) => {
  const nombres = normalizar(req.query.nombres);
  const apPat = normalizar(req.query.apellido_paterno);
  const apMat = normalizar(req.query.apellido_materno);

  if (!nombres || !apPat) {
    return res
      .status(400)
      .json({ message: 'Indica nombres y apellido paterno' });
  }

  try {
    const filas = await sequelizeLocal.query(
      `
      SELECT ${COLUMNAS}
      FROM "public"."reniec_data" r
      WHERE r.ap_pat = :apPat
        AND (r.nombres = :nombres OR r.nombres LIKE :nombresLike)
        ${apMat ? 'AND r.ap_mat = :apMat' : ''}
      ORDER BY r.ap_mat, r.nombres
      LIMIT 10
      `,
      {
        replacements: {
          apPat,
          apMat,
          nombres,
          nombresLike: `${nombres} %`,
        },
        type: QueryTypes.SELECT,
      }
    );

    return res.json(filas);
  } catch (error) {
    console.error('Error buscando por nombres:', error.message);
    return res.status(500).json({ message: 'No se pudo consultar RENIEC' });
  }
});

module.exports = router;