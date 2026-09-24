const { validationResult } = require('express-validator');
const { Auditoria } = require('../models');
const { AuditoriaDto } = require('../dtos/auditoriaDto');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

const listar = async (req, res, next) => {
  try {
    const { entidad, usuario } = req.query;
    const where = {};
    if (entidad) where.entidad = entidad;
    if (usuario) where.usuario_id = usuario;
    const auditorias = await Auditoria.findAll({ where, include: [{ model: Auditoria.sequelize.models.Usuario, as: 'usuario' }], order: [['fecha', 'DESC']] });
    res.json({ data: auditorias.map(a => AuditoriaDto.fromModel(a)) });
  } catch (error) { next(error); }
};
const obtener = async (req, res, next) => {
  try { const auditoria = await Auditoria.findByPk(req.params.id); if (!auditoria) return res.status(404).json({ error: 'Auditoría no encontrada' }); res.json({ data: AuditoriaDto.fromModel(auditoria) }); }
  catch (error) { next(error); }
};
module.exports = { listar, obtener };
