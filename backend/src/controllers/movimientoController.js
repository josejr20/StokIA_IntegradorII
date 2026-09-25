const { validationResult } = require('express-validator');
const { MovimientoInventario, Producto, Lote, Usuario } = require('../models');
const { MovimientoDto } = require('../dtos/movimientoDto');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

const listar = async (req, res, next) => {
  try {
    const { producto, tipo, origen, fecha_desde, fecha_hasta, search, lote_id, desde_ultimo_ingreso } = req.query;
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.page_size) || 10));
    const where = {};

    if (lote_id) where.lote_id = Number(lote_id);
    if (tipo) where.tipo = tipo;
    if (origen) where.origen = origen;
    if (fecha_desde || fecha_hasta) {
      where.fecha = {};
      if (fecha_desde) where.fecha[Op.gte] = new Date(fecha_desde);
      if (fecha_hasta) where.fecha[Op.lte] = new Date(`${fecha_hasta}T23:59:59.999Z`);
    }

    const include = [
      {
        model: Lote,
        as: 'lote',
        include: [{ model: Producto, as: 'producto' }],
      },
      { model: Usuario, as: 'usuario' },
    ];

    if (producto) where['$lote.producto_id$'] = Number(producto);

    if (search) {
      include[0].where = {
        [Op.or]: [
          { numero_lote: { [Op.iLike]: `%${search}%` } },
        ],
      };
    }

    if (desde_ultimo_ingreso === 'true' && producto) {
      const ultimoIngreso = await MovimientoInventario.findOne({
        where: { '$lote.producto_id$': Number(producto), tipo: 'ingreso' },
        include: [{ model: Lote, as: 'lote', attributes: [], where: { producto_id: Number(producto) } }],
        order: [['fecha', 'DESC'], ['id', 'DESC']],
      });
      if (ultimoIngreso) {
        where.fecha = { ...where.fecha, [Op.gte]: new Date(ultimoIngreso.fecha) };
      }
    }

    const movimientos = await MovimientoInventario.findAll({
      where,
      include,
      order: [['fecha', 'DESC'], ['id', 'DESC']],
    });

    const listado = movimientos.filter((mov) => {
      if (!search) return true;
      const texto = `${mov.lote?.producto?.nombre || ''} ${mov.lote?.producto?.codigo || ''} ${mov.lote?.numero_lote || ''}`.toLowerCase();
      return texto.includes(String(search).toLowerCase());
    });
    const inicio = (page - 1) * pageSize;
    const pagina = listado.slice(inicio, inicio + pageSize);

    res.json({
      data: pagina.map((movimiento) => MovimientoDto.fromModel(movimiento)),
      count: listado.length,
      previous: page > 1,
      next: inicio + pageSize < listado.length,
    });
  } catch (error) { next(error); }
};

const obtener = async (req, res, next) => {
  try {
    const movimiento = await MovimientoInventario.findByPk(req.params.id);
    if (!movimiento) return res.status(404).json({ error: 'Movimiento no encontrado' });
    res.json({ data: MovimientoDto.fromModel(movimiento) });
  } catch (error) { next(error); }
};

module.exports = { listar, obtener };
