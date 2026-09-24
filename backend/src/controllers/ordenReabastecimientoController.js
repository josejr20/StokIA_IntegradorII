const { validationResult } = require('express-validator');
const { OrdenReabastecimiento } = require('../models');
const { OrdenReabastecimientoDto } = require('../dtos/ordenReabastecimientoDto');
const logger = require('../utils/logger');

const listar = async (req, res, next) => {
  try {
    const { estado, producto } = req.query;
    const where = {};
    if (estado) where.estado = estado;
    if (producto) where.producto_id = producto;
    const ordenes = await OrdenReabastecimiento.findAll({ where, include: [{ model: OrdenReabastecimiento.sequelize.models.Producto, as: 'producto' }], order: [['fecha_creacion', 'DESC']] });
    res.json({ data: ordenes.map(o => OrdenReabastecimientoDto.fromModel(o)) });
  } catch (error) { next(error); }
};
const obtener = async (req, res, next) => {
  try { const orden = await OrdenReabastecimiento.findByPk(req.params.id); if (!orden) return res.status(404).json({ error: 'Orden no encontrada' }); res.json({ data: OrdenReabastecimientoDto.fromModel(orden) }); }
  catch (error) { next(error); }
};
const crear = async (req, res, next) => {
  try {
    const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ error: 'Datos inválidos', details: errors.array() });
    const data = OrdenReabastecimientoDto.fromCreate(req.body);
    const orden = await OrdenReabastecimiento.create({ ...data, generado_por: 'manual', usuario_id: req.user.id });
    res.status(201).json({ data: OrdenReabastecimientoDto.fromModel(orden) });
  } catch (error) { next(error); }
};
const actualizar = async (req, res, next) => {
  try { const orden = await OrdenReabastecimiento.findByPk(req.params.id); if (!orden) return res.status(404).json({ error: 'Orden no encontrada' }); const data = OrdenReabastecimientoDto.fromUpdate(req.body); await orden.update(data); res.json({ data: OrdenReabastecimientoDto.fromModel(orden) }); }
  catch (error) { next(error); }
};
const aprobar = async (req, res, next) => {
  try {
    const orden = await OrdenReabastecimiento.findByPk(req.params.id);
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' });
    orden.estado = 'aprobada';
    orden.cantidad_aprobada = req.body.cantidad_aprobada || orden.cantidad_sugerida;
    orden.usuario_id = req.user.id;
    await orden.save();
    res.json({ data: OrdenReabastecimientoDto.fromModel(orden) });
  } catch (error) { next(error); }
};
const rechazar = async (req, res, next) => {
  try {
    const orden = await OrdenReabastecimiento.findByPk(req.params.id);
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' });
    orden.estado = 'rechazada';
    orden.usuario_id = req.user.id;
    await orden.save();
    res.json({ data: OrdenReabastecimientoDto.fromModel(orden) });
  } catch (error) { next(error); }
};
module.exports = { listar, obtener, crear, actualizar, aprobar, rechazar };
