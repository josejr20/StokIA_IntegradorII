const { validationResult } = require('express-validator');
const { PreferenciaUsuario } = require('../models');
const { PreferenciaDto } = require('../dtos/preferenciaDto');
const logger = require('../utils/logger');

const listar = async (req, res, next) => {
  try {
    const preferencias = await PreferenciaUsuario.findAll({ where: { usuario_id: req.user.id } });
    res.json({ data: preferencias.map(p => PreferenciaDto.fromModel(p)) });
  } catch (error) { next(error); }
};
const obtener = async (req, res, next) => {
  try { const preferencia = await PreferenciaUsuario.findOne({ where: { usuario_id: req.user.id, clave: req.params.clave } }); if (!preferencia) return res.status(404).json({ error: 'Preferencia no encontrada' }); res.json({ data: PreferenciaDto.fromModel(preferencia) }); }
  catch (error) { next(error); }
};
const crear = async (req, res, next) => {
  try {
    const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ error: 'Datos inválidos', details: errors.array() });
    const data = PreferenciaDto.fromCreate(req.body); data.usuario_id = req.user.id;
    const [preferencia, created] = await PreferenciaUsuario.upsert(data, { returning: true });
    res.status(201).json({ data: PreferenciaDto.fromModel(preferencia) });
  } catch (error) { next(error); }
};
const actualizar = async (req, res, next) => {
  try {
    const preferencia = await PreferenciaUsuario.findOne({ where: { usuario_id: req.user.id, clave: req.params.clave } });
    if (!preferencia) return res.status(404).json({ error: 'Preferencia no encontrada' });
    const { PreferenciaDto } = require('../dtos/preferenciaDto');
    const data = PreferenciaDto.fromUpdate(req.body);
    await preferencia.update(data);
    res.json({ data: PreferenciaDto.fromModel(preferencia) });
  } catch (error) { next(error); }
};
const eliminar = async (req, res, next) => {
  try { const preferencia = await PreferenciaUsuario.findOne({ where: { usuario_id: req.user.id, clave: req.params.clave } }); if (!preferencia) return res.status(404).json({ error: 'Preferencia no encontrada' }); await preferencia.destroy(); res.json({ message: 'Preferencia eliminada' }); }
  catch (error) { next(error); }
};
module.exports = { listar, obtener, crear, actualizar, eliminar };
