const { validationResult } = require('express-validator');
const { ClienteDto } = require('../dtos/operacionDto');
const { Cliente, Operacion } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

const listar = async (req, res, next) => {
  try {
    const { buscar, activo } = req.query;
    const where = {};
    if (buscar) {
      where[Op.or] = [
        { nombre: { [Op.iLike]: `%${buscar}%` } },
        { documento: { [Op.iLike]: `%${buscar}%` } },
      ];
    }
    if (activo !== undefined) where.activo = activo === 'true' || activo === '1';
    const clientes = await Cliente.findAll({
      where,
      order: [['nombre', 'ASC']],
    });
    res.json({ data: clientes.map((c) => ClienteDto.fromModel(c)) });
  } catch (error) { next(error); }
};

const obtener = async (req, res, next) => {
  try {
    const cliente = await Cliente.findByPk(req.params.id);
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json({ data: ClienteDto.fromModel(cliente) });
  } catch (error) { next(error); }
};

const crear = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Datos inválidos', details: errors.array() });
    }
    const { nombre, documento } = req.body;
    if (!nombre || !String(nombre).trim()) {
      return res.status(400).json({ error: 'El nombre del cliente es obligatorio' });
    }
    const cliente = await Cliente.create({
      nombre: String(nombre).trim(),
      documento: documento ? String(documento).trim() : null,
    });
    logger.info(`Cliente creado: ${cliente.id}`);
    res.status(201).json({ data: ClienteDto.fromModel(cliente) });
  } catch (error) { next(error); }
};

const actualizar = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Datos inválidos', details: errors.array() });
    }
    const cliente = await Cliente.findByPk(req.params.id);
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });

    const { nombre, documento, activo } = req.body;
    if (nombre !== undefined) {
      if (!String(nombre).trim()) {
        return res.status(400).json({ error: 'El nombre del cliente es obligatorio' });
      }
      cliente.nombre = String(nombre).trim();
    }
    if (documento !== undefined) cliente.documento = documento ? String(documento).trim() : null;
    if (activo !== undefined) cliente.activo = Boolean(activo);
    await cliente.save();
    res.json({ data: ClienteDto.fromModel(cliente) });
  } catch (error) { next(error); }
};

const historial = async (req, res, next) => {
  try {
    const operaciones = await Operacion.findAll({
      where: { cliente_id: req.params.id },
      order: [['fecha', 'DESC'], ['id', 'DESC']],
    });
    res.json({
      data: operaciones.map((o) => ({
        id: Number(o.id),
        numero: o.numero,
        tipo: o.tipo,
        fecha: o.fecha,
        total: Number(o.total),
        estado: o.estado,
      })),
    });
  } catch (error) { next(error); }
};

module.exports = { listar, obtener, crear, actualizar, historial };
