const { validationResult } = require('express-validator');
const { Lote, Producto, MovimientoInventario, Usuario } = require('../models');
const { LoteDto } = require('../dtos/loteDto');
const { MovimientoDto } = require('../dtos/movimientoDto');
const { registrarMovimiento } = require('../services/kardexService');
const { generarCodigoLote, validarLoteParaCreacion } = require('../services/loteService');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

const listar = async (req, res, next) => {
  try {
    const { producto, numero_lote } = req.query;
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.page_size) || 10));
    const where = {};
    if (producto) where.producto_id = producto;
    if (numero_lote) where.numero_lote = { [Op.like]: `%${numero_lote}%` };
    const resultado = await Lote.findAndCountAll({
      where,
      include: [{ model: Lote.sequelize.models.Producto, as: 'producto' }],
      order: [['fecha_ingreso', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    res.json({
      data: resultado.rows.map((lote) => LoteDto.fromModel(lote)),
      count: resultado.count,
      previous: page > 1,
      next: page * pageSize < resultado.count,
    });
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
    validarLoteParaCreacion({ cantidad_inicial: cantidadInicial, fecha_vencimiento: req.body.fecha_vencimiento });

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
    const movimientos = await MovimientoInventario.findAll({
      where: { lote_id: lote.id },
      include: [
        { model: Lote, as: 'lote', include: [{ model: Producto, as: 'producto' }] },
        { model: Usuario, as: 'usuario' },
      ],
      order: [['fecha', 'DESC'], ['id', 'DESC']],
    });
    res.json({ data: movimientos.map((movimiento) => MovimientoDto.fromModel(movimiento)) });
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
    const motivo = String(req.body.motivo || '').trim();
    if (['salida', 'ajuste'].includes(tipo) && !motivo) {
      return res.status(400).json({ error: 'El motivo es obligatorio para salidas y ajustes' });
    }

    const producto = await Producto.findByPk(lote.producto_id);
    if (!producto || !producto.activo) return res.status(400).json({ error: 'No se pueden registrar movimientos en un producto inactivo' });

    transaction = await Lote.sequelize.transaction();
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
      motivo,
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
