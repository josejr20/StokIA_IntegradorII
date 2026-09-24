const { validationResult } = require('express-validator');
const { Lote, Producto } = require('../models');
const { LoteDto } = require('../dtos/loteDto');
const { registrarMovimiento } = require('../services/kardexService');
const { generarCodigoLote, validarLoteParaCreacion } = require('../services/loteService');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

const listar = async (req, res, next) => {
  try {
    const { producto, numero_lote } = req.query;
    const where = {};
    if (producto) where.producto_id = producto;
    if (numero_lote) where.numero_lote = { [Op.like]: `%${numero_lote}%` };
    const lotes = await Lote.findAll({ where, include: [{ model: Lote.sequelize.models.Producto, as: 'producto' }], order: [['fecha_ingreso', 'DESC']] });
    res.json({ data: lotes.map(l => LoteDto.fromModel(l)) });
  } catch (error) { next(error); }
};

const obtener = async (req, res, next) => {
  try {
    const lote = await Lote.findByPk(req.params.id, { include: [{ model: Lote.sequelize.models.Producto, as: 'producto' }] });
    if (!lote) return res.status(404).json({ error: 'Lote no encontrado' });
    res.json({ data: LoteDto.fromModel(lote) });
  } catch (error) { next(error); }
};

const crear = async (req, res, next) => {
  let transaction;
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Datos inválidos', details: errors.array() });

    const producto = await Producto.findByPk(req.body.producto_id);
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    if (!producto.activo) return res.status(400).json({ error: 'No se puede crear un lote para un producto inactivo' });

    const cantidadInicial = Number(req.body.cantidad_inicial ?? req.body.cantidad_actual ?? 0);
    validarLoteParaCreacion({ cantidad_inicial, fecha_vencimiento: req.body.fecha_vencimiento });

    const siguienteNumero = (await Lote.max('id', { where: { producto_id: req.body.producto_id } }) || 0) + 1;
    const data = LoteDto.fromCreate({
      ...req.body,
      numero_lote: req.body.numero_lote || generarCodigoLote(siguienteNumero),
      cantidad_inicial: cantidadInicial,
      cantidad_actual: req.body.cantidad_actual !== undefined ? Number(req.body.cantidad_actual) : cantidadInicial,
    });

    transaction = await Lote.sequelize.transaction();
    const lote = await Lote.create(data, { transaction });
    await registrarMovimiento(
      lote.id,
      'ingreso',
      cantidadInicial,
      'inicial',
      'Ingreso inicial del lote',
      null,
      req.user?.id || null,
      transaction
    );
    await transaction.commit();
    res.status(201).json({ data: LoteDto.fromModel(lote) });
  } catch (error) {
    if (transaction) await transaction.rollback();
    next(error);
  }
};

const actualizar = async (req, res, next) => {
  try {
    const lote = await Lote.findByPk(req.params.id);
    if (!lote) return res.status(404).json({ error: 'Lote no encontrado' });
    const data = LoteDto.fromUpdate(req.body);
    await lote.update(data);
    res.json({ data: LoteDto.fromModel(lote) });
  } catch (error) { next(error); }
};

const eliminar = async (req, res, next) => {
  try {
    const lote = await Lote.findByPk(req.params.id);
    if (!lote) return res.status(404).json({ error: 'Lote no encontrado' });
    await lote.destroy();
    res.json({ message: 'Lote eliminado' });
  } catch (error) { next(error); }
};

const historial = async (req, res, next) => {
  try {
    const lote = await Lote.findByPk(req.params.id);
    if (!lote) return res.status(404).json({ error: 'Lote no encontrado' });
    const movimientos = await lote.getMovimientos({ order: [['fecha', 'DESC']] });
    res.json({ data: movimientos });
  } catch (error) { next(error); }
};

const registrarMovimientoCtrl = async (req, res, next) => {
  let transaction;
  try {
    const lote = await Lote.findByPk(req.params.id);
    if (!lote) return res.status(404).json({ error: 'Lote no encontrado' });

    const tipo = req.body.tipo;
    if (!['ingreso', 'salida', 'ajuste'].includes(tipo)) {
      return res.status(400).json({ error: 'Tipo inválido' });
    }

    const cantidad = parseFloat(req.body.cantidad);
    if (!Number.isFinite(cantidad) || cantidad <= 0) return res.status(400).json({ error: 'Cantidad inválida' });

    const producto = await Producto.findByPk(lote.producto_id);
    if (!producto || !producto.activo) return res.status(400).json({ error: 'No se pueden registrar movimientos en un producto inactivo' });

    const transaction = await Lote.sequelize.transaction();
    const loteBloqueado = await Lote.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (['salida', 'ajuste'].includes(tipo) && Number(loteBloqueado.cantidad_actual) < cantidad) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Stock insuficiente' });
    }

    const movimiento = await registrarMovimiento(
      loteBloqueado.id,
      tipo,
      cantidad,
      req.body.origen || 'otro',
      req.body.motivo || '',
      req.body.precio_unitario || null,
      req.user.id,
      transaction
    );
    await transaction.commit();
    res.json({ data: movimiento });
  } catch (error) {
    if (transaction) await transaction.rollback();
    next(error);
  }
};

module.exports = { listar, obtener, crear, actualizar, eliminar, historial, registrarMovimientoCtrl };
