const { validationResult } = require('express-validator');
const { Alerta } = require('../models');
const { AlertaDto } = require('../dtos/alertaDto');
const alertaService = require('../services/alertaService');
const logger = require('../utils/logger');

const listar = async (req, res, next) => {
  try {
    const { tipo, severidad, estado, producto } = req.query;
    const where = {};
    if (tipo) where.tipo = tipo;
    if (severidad) where.severidad = severidad;
    if (estado) where.estado = estado;
    if (producto) where.producto_id = producto;
    const alertas = await Alerta.findAll({ where, order: [['fecha_creacion', 'DESC']] });
    res.json({ data: alertas.map(a => AlertaDto.fromModel(a)) });
  } catch (error) { next(error); }
};
const obtener = async (req, res, next) => {
  try { const alerta = await Alerta.findByPk(req.params.id); if (!alerta) return res.status(404).json({ error: 'Alerta no encontrada' }); res.json({ data: AlertaDto.fromModel(alerta) }); }
  catch (error) { next(error); }
};
const crear = async (req, res, next) => {
  try {
    const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ error: 'Datos inválidos', details: errors.array() });
    const data = AlertaDto.fromCreate(req.body); const alerta = await Alerta.create(data);
    res.status(201).json({ data: AlertaDto.fromModel(alerta) });
  } catch (error) { next(error); }
};
const actualizar = async (req, res, next) => {
  try { const alerta = await Alerta.findByPk(req.params.id); if (!alerta) return res.status(404).json({ error: 'Alerta no encontrada' }); const data = AlertaDto.fromUpdate(req.body); await alerta.update(data); res.json({ data: AlertaDto.fromModel(alerta) }); }
  catch (error) { next(error); }
};
const marcarVista = async (req, res, next) => {
  try { const alerta = await Alerta.findByPk(req.params.id); if (!alerta) return res.status(404).json({ error: 'Alerta no encontrada' }); alerta.estado = 'vista'; await alerta.save(); res.json({ data: AlertaDto.fromModel(alerta) }); }
  catch (error) { next(error); }
};
const atender = async (req, res, next) => {
  try { const alerta = await Alerta.findByPk(req.params.id); if (!alerta) return res.status(404).json({ error: 'Alerta no encontrada' }); alerta.estado = 'atendida'; alerta.fecha_atendida = new Date(); await alerta.save(); res.json({ data: AlertaDto.fromModel(alerta) }); }
  catch (error) { next(error); }
};
const notificar = async (req, res, next) => {
  try {
    const alerta = await Alerta.findByPk(req.params.id);
    if (!alerta) return res.status(404).json({ error: 'Alerta no encontrada' });
    const { correoService } = require('../services/correoService');
    const destinatarios = req.body.destinatarios || [];
    for (const correo of destinatarios) {
      const enviado = await correoService.enviarCorreo(
        correo,
        `Alerta ${alerta.severidad}: ${alerta.producto_id}`,
        alerta.mensaje
      );
      await require('../models').NotificacionCorreo.create({
        alerta_id: alerta.id, destinatario: correo,
        estado: enviado ? 'enviado' : 'fallido',
        fecha_envio: enviado ? new Date() : null
      });
    }
    res.json({ message: 'Notificaciones procesadas' });
  } catch (error) { next(error); }
};
const sincronizarML = async (req, res, next) => {
  try {
    const { procesadas } = await alertaService.sincronizarAlertasML();
    res.json({ data: { procesadas } });
  } catch (error) { next(error); }
};
module.exports = { listar, obtener, crear, actualizar, marcarVista, atender, notificar, sincronizarML };
