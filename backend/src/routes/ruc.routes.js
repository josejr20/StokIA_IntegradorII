// PASO 1: guardar como backend/src/routes/ruc.routes.js
// (reemplaza el contenido si ya habías guardado la versión anterior)
const express = require('express');

const router = express.Router();

// Si tus rutas de clientes usan un middleware de autenticación,
// aplícalo también aquí:
// router.use(requireAuth);

const URL_BASE = process.env.FACILRUC_URL || 'https://facilruc.com/api/v1/ruc';
// Solo si tu cuenta de facilruc entrega un token (no se usa si está vacío).
const TOKEN = process.env.FACILRUC_TOKEN || '';

const TIEMPO_ESPERA_MS = 8000;
const DURACION_CACHE_MS = 24 * 60 * 60 * 1000;

// Evita repetir consultas del mismo RUC durante 24 horas.
const cache = new Map();

// Valida el dígito verificador del RUC (módulo 11).
function rucValido(ruc) {
  if (!/^(10|15|17|20)\d{9}$/.test(ruc)) return false;

  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((acc, peso, i) => acc + peso * Number(ruc[i]), 0);

  let digito = 11 - (suma % 11);
  if (digito === 10) digito = 0;
  if (digito === 11) digito = 1;

  return digito === Number(ruc[10]);
}

// Hace un GET a facilruc y devuelve { estado, json }.
async function pedir(url) {
  const headers = { Accept: 'application/json' };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;

  const respuesta = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(TIEMPO_ESPERA_MS),
  });

  let json = null;
  try {
    json = await respuesta.json();
  } catch {
    json = null;
  }

  return { estado: respuesta.status, json, ok: respuesta.ok };
}

// GET /api/ruc/:ruc
// Paso 1: valida que el RUC exista. Paso 2: si es válido, trae la razón social.
// Respuesta: { ruc, razon_social, tipo, estado, condicion, domicilio_fiscal }
router.get('/:ruc', async (req, res) => {
  const ruc = String(req.params.ruc || '').trim();

  if (!/^\d{11}$/.test(ruc)) {
    return res.status(400).json({ message: 'El RUC debe tener 11 dígitos' });
  }

  // Revisión local previa: evita llamadas a la API con RUC mal escritos.
  if (!rucValido(ruc)) {
    return res.status(400).json({ message: 'El RUC no es válido' });
  }

  const guardado = cache.get(ruc);
  if (guardado && guardado.vence > Date.now()) {
    return res.json(guardado.datos);
  }

  try {
    // Paso 1: validación en facilruc.
    const validacion = await pedir(`${URL_BASE}/validar/${ruc}`);

    if (validacion.estado === 404 || (validacion.ok && !validacion.json?.valido)) {
      return res.status(404).json({ message: 'El RUC no existe en SUNAT' });
    }

    if (!validacion.ok) {
      console.error('facilruc (validar) respondió con estado', validacion.estado);
      return res
        .status(502)
        .json({ message: 'El servicio de consulta de RUC no está disponible' });
    }

    // Paso 2: datos del contribuyente.
    const detalle = await pedir(`${URL_BASE}/${ruc}`);

    if (detalle.estado === 404) {
      return res.status(404).json({ message: 'No se encontró ese RUC en SUNAT' });
    }

    if (!detalle.ok || !detalle.json) {
      console.error('facilruc (detalle) respondió con estado', detalle.estado);
      return res
        .status(502)
        .json({ message: 'El servicio de consulta de RUC no está disponible' });
    }

    const d = detalle.json;

    if (!String(d.razon_social || '').trim()) {
      return res
        .status(404)
        .json({ message: 'El RUC es válido pero no tiene razón social registrada' });
    }

    const datos = {
      ruc: String(d.ruc || ruc),
      razon_social: String(d.razon_social).trim().toUpperCase(),
      tipo: String(validacion.json.tipo || d.tipo || '').trim(),
      estado: String(d.estado || '').toUpperCase(),
      condicion: String(d.condicion || '').toUpperCase(),
      domicilio_fiscal: String(d.domicilio_fiscal || '').trim(),
    };

    cache.set(ruc, { datos, vence: Date.now() + DURACION_CACHE_MS });

    return res.json(datos);
  } catch (error) {
    const agotado = error.name === 'TimeoutError' || error.name === 'AbortError';

    console.error('Error consultando RUC:', error.message);

    return res.status(agotado ? 504 : 502).json({
      message: agotado
        ? 'La consulta de RUC tardó demasiado, intenta de nuevo'
        : 'No se pudo consultar el RUC',
    });
  }
});

module.exports = router;