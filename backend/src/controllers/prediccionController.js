'use strict';

const servicio = require('../services/prediccionDemandaService');
const { validarHorizonte } = require('../services/prediccionDemandaModelo');

const MAX_PRODUCTOS = 10;

class ParametrosInvalidos extends Error {}

/** Lee y valida ?producto_ids=1,2,3&horizonte_dias=7 (HU-72 TC-03). */
function leerParametros(query = {}) {
  const crudo = Array.isArray(query.producto_ids)
    ? query.producto_ids.join(',')
    : String(query.producto_ids ?? '');
  const ids = [...new Set(crudo.split(',').map((valor) => valor.trim()).filter(Boolean).map(Number))];

  if (ids.length === 0) throw new ParametrosInvalidos('Selecciona al menos un producto para analizar');
  if (ids.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw new ParametrosInvalidos('Los identificadores de producto no son válidos');
  }
  if (ids.length > MAX_PRODUCTOS) {
    throw new ParametrosInvalidos(`Puedes analizar hasta ${MAX_PRODUCTOS} productos a la vez`);
  }

  let horizonte;
  try {
    horizonte = validarHorizonte(query.horizonte_dias);
  } catch (error) {
    throw new ParametrosInvalidos(error.message);
  }
  return { ids, horizonte };
}

const demanda = async (req, res, next) => {
  try {
    const { ids, horizonte } = leerParametros(req.query);
    const data = await servicio.predecirProductos(ids, { horizonte });
    res.json({ data });
  } catch (error) {
    if (error instanceof ParametrosInvalidos) return res.status(400).json({ error: error.message });
    return next(error);
  }
};

module.exports = { demanda, leerParametros, ParametrosInvalidos, MAX_PRODUCTOS };
