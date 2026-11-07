'use strict';

const { validationResult } = require('express-validator');
const { UmbralConfiguracion } = require('../models');
const { UmbralDto } = require('../dtos/umbralDto');
const logger = require('../utils/logger');
const { validarStockMinimo, ErrorStockMinimo } = require('../services/reglasStockMinimo');
const {
  obtenerResumenStockMinimo,
  guardarStockMinimo,
  restablecerStockMinimo,
  evaluarAlertasStockMinimo
} = require('../services/stockMinimoService');

function responderError(res, next, error) {
  if (error instanceof ErrorStockMinimo) return res.status(error.status).json({ error: error.message });
  return next(error);
}

const listar = async (req, res, next) => {
  try {
    const where = req.query.tipo ? { tipo: req.query.tipo } : {};
    const umbrales = await UmbralConfiguracion.findAll({
      where,
      include: [{ model: UmbralConfiguracion.sequelize.models.Producto, as: 'producto' }]
    });
    res.json({ data: umbrales.map((u) => UmbralDto.fromModel(u)) });
  } catch (error) { next(error); }
};

const obtener = async (req, res, next) => {
  try {
    const umbral = await UmbralConfiguracion.findByPk(req.params.id);
    if (!umbral) return res.status(404).json({ error: 'Umbral no encontrado' });
    res.json({ data: UmbralDto.fromModel(umbral) });
  } catch (error) { next(error); }
};

const crear = async (req, res, next) => {
  try {
    const errores = validationResult(req);
    if (!errores.isEmpty()) return res.status(400).json({ error: 'Datos invalidos', details: errores.array() });
    const data = UmbralDto.fromCreate(req.body);
    if (data.tipo === 'stock_minimo') data.valor = validarStockMinimo(data.valor);
    const umbral = await UmbralConfiguracion.create(data);
    res.status(201).json({ data: UmbralDto.fromModel(umbral) });
  } catch (error) { responderError(res, next, error); }
};

const actualizar = async (req, res, next) => {
  try {
    const umbral = await UmbralConfiguracion.findByPk(req.params.id);
    if (!umbral) return res.status(404).json({ error: 'Umbral no encontrado' });
    const data = UmbralDto.fromUpdate(req.body);
    if ((data.tipo || umbral.tipo) === 'stock_minimo') {
      data.valor = validarStockMinimo(data.valor === undefined ? umbral.valor : data.valor);
    }
    data.fecha_actualizacion = new Date();
    await umbral.update(data);
    res.json({ data: UmbralDto.fromModel(umbral) });
  } catch (error) { responderError(res, next, error); }
};

const eliminar = async (req, res, next) => {
  try {
    const umbral = await UmbralConfiguracion.findByPk(req.params.id);
    if (!umbral) return res.status(404).json({ error: 'Umbral no encontrado' });
    await umbral.destroy();
    res.json({ message: 'Umbral eliminado' });
  } catch (error) { next(error); }
};

// US-24: operaciones exclusivas del stock minimo por producto.
const resumenStockMinimo = async (req, res, next) => {
  try { res.json(await obtenerResumenStockMinimo()); }
  catch (error) { responderError(res, next, error); }
};

async function intentarEvaluarProducto(productoId, usuarioId) {
  try {
    return { evaluacion: await evaluarAlertasStockMinimo(productoId, { usuarioId }), aviso: null };
  } catch (error) {
    logger.warn(`No se pudo actualizar la alerta de stock del producto ${productoId}: ${error.message}`);
    return {
      evaluacion: null,
      aviso: 'La configuracion se guardo, pero no se pudo actualizar la alerta. Intente evaluar nuevamente.'
    };
  }
}

const guardarMinimoProducto = async (req, res, next) => {
  try {
    if (!req.body || !Object.prototype.hasOwnProperty.call(req.body, 'valor')) {
      throw new ErrorStockMinimo('Indique el stock minimo.');
    }
    const registro = await guardarStockMinimo(req.params.productoId, req.body.valor);
    const resultado = await intentarEvaluarProducto(registro.producto_id, req.user.id);
    res.json({ data: UmbralDto.fromModel(registro), message: 'Stock minimo guardado correctamente.', ...resultado });
  } catch (error) { responderError(res, next, error); }
};

const quitarMinimoProducto = async (req, res, next) => {
  try {
    await restablecerStockMinimo(req.params.productoId);
    const resultado = await intentarEvaluarProducto(req.params.productoId, req.user.id);
    res.json({ message: 'Se restablecio el stock minimo por defecto.', ...resultado });
  } catch (error) { responderError(res, next, error); }
};

const evaluarTodosStockMinimo = async (req, res, next) => {
  try {
    const data = await evaluarAlertasStockMinimo(null, { usuarioId: req.user.id });
    res.json({ data, message: 'Evaluacion de stock minimo completada.' });
  } catch (error) { responderError(res, next, error); }
};

module.exports = {
  listar, obtener, crear, actualizar, eliminar,
  resumenStockMinimo, guardarMinimoProducto, quitarMinimoProducto, evaluarTodosStockMinimo
};
