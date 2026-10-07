const { Lote, Producto, MovimientoInventario, Usuario } = require('../models');
const { LoteDto } = require('../dtos/loteDto');
const { MovimientoDto } = require('../dtos/movimientoDto');
const { ErrorKardex, registrarMovimiento } = require('../services/kardexService');
const { ErrorLote, generarCodigoLote, validarLoteParaCreacion } = require('../services/loteService');
const logger = require('../utils/logger');
const { Op } = require('sequelize');
const { UniqueConstraintError } = require('sequelize');

const listar = async (req, res, next) => {
  try {
    const { producto, numero_lote, fecha_desde, fecha_hasta, estado, orden } = req.query;
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.page_size) || 10));
    const where = {};
    if (producto) where.producto_id = producto;
    if (numero_lote) where.numero_lote = { [Op.iLike]: `%${numero_lote}%` };
    if (fecha_desde || fecha_hasta) {
      where.fecha_ingreso = {
        ...(fecha_desde && { [Op.gte]: fecha_desde }),
        ...(fecha_hasta && { [Op.lte]: fecha_hasta }),
      };
    }
    if (estado === 'agotado') where.cantidad_actual = 0;
    if (estado === 'con_stock') where.cantidad_actual = { [Op.gt]: 0 };
    // Los estados 'vencido' / 'por_vencer' se agregan en el Sprint 2, cuando ML defina la fecha de vencimiento.
    const order = orden === 'ingreso_asc'
      ? [['fecha_ingreso', 'ASC']]
      : [['fecha_ingreso', 'DESC']];
    const resultado = await Lote.findAndCountAll({
      where,
      include: [{ model: Lote.sequelize.models.Producto, as: 'producto' }],
      order,
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
  let reintentado = false;
  try {
    const productoId = req.body.producto_id;
    if (!productoId || Number(productoId) <= 0) {
      return res.status(400).json({ error: 'producto_id es obligatorio y debe ser un entero positivo' });
    }

    const producto = await Producto.findByPk(productoId);
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    if (!producto.activo) return res.status(400).json({ error: 'No se puede crear un lote para un producto inactivo' });

    const cantidadInicial = Number(req.body.cantidad_inicial ?? req.body.cantidad_actual ?? 0);
    if (req.body.cantidad_actual !== undefined && Number(req.body.cantidad_actual) !== cantidadInicial) {
      return res.status(400).json({ error: 'La cantidad actual inicial debe coincidir con la cantidad inicial' });
    }
    validarLoteParaCreacion({ cantidad_inicial: cantidadInicial });

    const siguienteNumero = (await Lote.max('id', { where: { producto_id: productoId } }) || 0) + 1;
    const data = LoteDto.fromCreate({
      ...req.body,
      numero_lote: req.body.numero_lote || generarCodigoLote(siguienteNumero),
      cantidad_inicial: cantidadInicial,
      cantidad_actual: 0,
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
    await lote.reload();
    res.status(201).json({ data: LoteDto.fromModel(lote) });
  } catch (error) {
    if (transaction) await transaction.rollback();
    if (error instanceof ErrorKardex) return res.status(400).json({ error: error.message });
    if (error instanceof ErrorLote) return res.status(400).json({ error: error.message });
    if (error instanceof UniqueConstraintError && !reintentado && error.fields?.numero_lote) {
      reintentado = true;
      return crear(req, res, next);
    }
    next(error);
  }
};

const actualizar = async (req, res, next) => {
  try {
    const lote = await Lote.findByPk(req.params.id);
    if (!lote) return res.status(404).json({ error: 'Lote no encontrado' });
    if (req.body.cantidad_inicial !== undefined || req.body.cantidad_actual !== undefined) {
      return res.status(400).json({ error: 'El stock solo puede modificarse mediante movimientos de kardex' });
    }
    const data = LoteDto.fromUpdate(req.body);
    await lote.update(data);
    res.json({ data: LoteDto.fromModel(lote) });
  } catch (error) {
    if (error instanceof UniqueConstraintError && error.fields?.numero_lote) {
      return res.status(409).json({ error: 'El número de lote ya existe para este producto' });
    }
    next(error);
  }
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

const historialProductos = async (req, res, next) => {
  try {
    const productoIds = String(req.query.producto_ids || '')
      .split(',')
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0);
    if (!productoIds.length) {
      return res.status(400).json({ error: 'Selecciona al menos un producto válido' });
    }

    const movimientos = await MovimientoInventario.findAll({
      include: [
        {
          model: Lote,
          as: 'lote',
          where: { producto_id: { [Op.in]: [...new Set(productoIds)] } },
          include: [{ model: Producto, as: 'producto' }],
        },
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

    let tipo = req.body.tipo;
    let origen = req.body.origen || 'otro';
    const cantidad = Number(req.body.cantidad);
    if (!Number.isFinite(cantidad) || cantidad <= 0) return res.status(400).json({ error: 'Cantidad inválida' });

    // HU8.1: Ajustes se expresan como ingreso/salida con origen='ajuste'
    // Mantener 'ajuste' como alias de salida para compatibilidad
    if (tipo === 'ajuste') {
      tipo = 'salida';
      origen = 'ajuste';
    }
    if (origen === 'ajuste' && !['ingreso', 'salida'].includes(tipo)) {
      return res.status(400).json({ error: 'Con origen "ajuste", el tipo debe ser "ingreso" o "salida"' });
    }
    if (!['ingreso', 'salida'].includes(tipo)) {
      return res.status(400).json({ error: 'Tipo inválido. Use "ingreso" o "salida"' });
    }

    const motivo = String(req.body.motivo || '').trim();
    if (tipo === 'salida' && !motivo) {
      return res.status(400).json({ error: 'El motivo es obligatorio para salidas' });
    }

    const producto = await Producto.findByPk(lote.producto_id);
    if (!producto || !producto.activo) return res.status(400).json({ error: 'No se pueden registrar movimientos en un producto inactivo' });

    transaction = await Lote.sequelize.transaction();
    const movimiento = await registrarMovimiento(
      lote.id,
      tipo,
      cantidad,
      origen,
      motivo,
      req.body.precio_unitario ?? null,
      req.user.id,
      transaction
    );
    await transaction.commit();
    res.json({ data: movimiento });
  } catch (error) {
    if (transaction) await transaction.rollback();
    if (error instanceof ErrorKardex) return res.status(400).json({ error: error.message });
    next(error);
  }
};

module.exports = { listar, obtener, crear, actualizar, historial, historialProductos, registrarMovimientoCtrl };
