const { validationResult } = require('express-validator');
const { OperacionDto, ComprobanteDto } = require('../dtos/operacionDto');
const {
  ErrorOperacion,
  crearOperacion,
  obtenerOperacion,
  obtenerComprobanteOperacion,
  listarOperaciones,
  anularOperacion,
  leerConfiguracionImpuesto,
  guardarConfiguracionImpuesto,
} = require('../services/operacionService');
const logger = require('../utils/logger');

const TIPOS_VALIDOS = ['venta', 'devolucion', 'ajuste'];

const listar = async (req, res, next) => {
  try {
    const { tipo, cliente_id, fecha_desde, fecha_hasta, buscar } = req.query;
    if (tipo && !TIPOS_VALIDOS.includes(tipo)) {
      return res.status(400).json({ error: 'Tipo de operación inválido' });
    }
    const operaciones = await listarOperaciones({
      tipo,
      cliente_id: cliente_id ? Number(cliente_id) : undefined,
      fecha_desde,
      fecha_hasta,
      buscar,
    });
    res.json({ data: operaciones.map((o) => OperacionDto.fromModel(o)) });
  } catch (error) { next(error); }
};

const obtener = async (req, res, next) => {
  try {
    const operacion = await obtenerOperacion(req.params.id);
    if (!operacion) return res.status(404).json({ error: 'Operación no encontrada' });
    res.json({ data: OperacionDto.fromModel(operacion) });
  } catch (error) { next(error); }
};

const crear = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Datos inválidos', details: errors.array() });
    }

    const { tipo } = req.body;
    if (!tipo || !TIPOS_VALIDOS.includes(tipo)) {
      return res.status(400).json({ error: 'Debe indicar el tipo de operación (venta, devolucion, ajuste)' });
    }

    const resultado = await crearOperacion({
      tipo,
      cliente_id: req.body.cliente_id ? Number(req.body.cliente_id) : null,
      items: req.body.items,
      fecha: req.body.fecha ? new Date(req.body.fecha) : null,
      motivo: req.body.motivo,
      operacion_origen_id: req.body.operacion_origen_id ? Number(req.body.operacion_origen_id) : null,
      signo: req.body.signo,
      idempotency_key: req.body.idempotency_key,
      usuario_id: req.user.id,
    });

    if (resultado.repetida) {
      return res.json({ data: OperacionDto.fromModel(resultado.operacion), repetida: true });
    }
    res.status(201).json({ data: OperacionDto.fromModel(resultado.operacion) });
  } catch (error) {
    if (error instanceof ErrorOperacion) {
      logger.warn(`Operación rechazada: ${error.message}`);
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
};

const obtenerComprobante = async (req, res, next) => {
  try {
    const resultado = await obtenerComprobanteOperacion(req.params.id);
    if (!resultado.operacion) return res.status(404).json({ error: 'Operación no encontrada' });
    if (!resultado.comprobante) {
      return res.status(404).json({ error: 'La operación no tiene comprobante' });
    }
    res.json({ data: ComprobanteDto.fromModel(resultado.comprobante) });
  } catch (error) { next(error); }
};

const anular = async (req, res, next) => {
  try {
    const operacion = await anularOperacion(req.params.id, req.user.id);
    res.json({ data: OperacionDto.fromModel(operacion) });
  } catch (error) {
    if (error instanceof ErrorOperacion) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
};

const verImpuesto = async (req, res, next) => {
  try {
    res.json({ data: await leerConfiguracionImpuesto() });
  } catch (error) { next(error); }
};

const configurarImpuesto = async (req, res, next) => {
  try {
    res.json({ data: await guardarConfiguracionImpuesto(req.body.impuesto_porcentaje, req.user.id) });
  } catch (error) {
    if (error instanceof ErrorOperacion) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
};

module.exports = {
  listar,
  obtener,
  crear,
  obtenerComprobante,
  anular,
  verImpuesto,
  configurarImpuesto,
};
