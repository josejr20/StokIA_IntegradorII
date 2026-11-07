'use strict';

const servicio = require('../services/riesgoVencimientoService');
const { sincronizarAlertasRiesgo } = require('../services/notificacionAlertaService');
const logger = require('../utils/logger');

const MAX_PRODUCTOS = 100;

class ParametrosInvalidos extends Error {}

/** Lee y valida ?producto_ids=1,2,3&nivel=alto (los dos son opcionales). */
function leerParametros(query = {}) {
  let ids = null;
  if (query.producto_ids !== undefined && String(query.producto_ids).trim() !== '') {
    const crudo = Array.isArray(query.producto_ids) ? query.producto_ids.join(',') : String(query.producto_ids);
    ids = [...new Set(crudo.split(',').map((valor) => valor.trim()).filter(Boolean).map(Number))];
    if (ids.some((id) => !Number.isInteger(id) || id <= 0)) {
      throw new ParametrosInvalidos('Los identificadores de producto no son válidos');
    }
    if (ids.length > MAX_PRODUCTOS) {
      throw new ParametrosInvalidos(`Puedes consultar hasta ${MAX_PRODUCTOS} productos a la vez`);
    }
  }

  let nivel = null;
  if (query.nivel !== undefined && String(query.nivel).trim() !== '') {
    nivel = String(query.nivel).trim().toLowerCase();
    if (!servicio.NIVELES_FILTRO.includes(nivel)) {
      throw new ParametrosInvalidos(`El nivel debe ser uno de: ${servicio.NIVELES_FILTRO.join(', ')}`);
    }
  }
  return { ids, nivel };
}

const listar = async (req, res, next) => {
  try {
    const { ids, nivel } = leerParametros(req.query);
    const data = await servicio.analizarRiesgo({ productoIds: ids });
    try {
      await sincronizarAlertasRiesgo(data.productos, {
        alcanceProductoIds: ids,
        usuarioId: req.user.id,
      });
    } catch (error) {
      logger.error(`No se pudieron sincronizar las alertas de vencimiento: ${error.message}`);
    }
    if (nivel) data.productos = data.productos.filter((producto) => producto.nivel === nivel);
    res.json({ data });
  } catch (error) {
    if (error instanceof ParametrosInvalidos) return res.status(400).json({ error: error.message });
    return next(error);
  }
};

module.exports = { listar, leerParametros, ParametrosInvalidos, MAX_PRODUCTOS };
