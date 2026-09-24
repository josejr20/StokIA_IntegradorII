const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');
const { validationResult } = require('express-validator');
const { Producto, ProductoPresentacion } = require('../models');
const { ProductoDto } = require('../dtos/productoDto');
const { Lote } = require('../models');
const { registrarMovimiento } = require('../services/kardexService');
const logger = require('../utils/logger');

function imagenGuardada(file) {
  return file ? `/upload/productos/${file.filename}` : null;
}

function parseCaracteristicas(value) {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch (_error) { return {}; }
}

function parsePresentaciones(value) {
  if (!value) return [];
  const presentaciones = typeof value === 'string' ? JSON.parse(value) : value;
  if (!Array.isArray(presentaciones)) return [];
  return presentaciones.map((presentacion, indice) => ({
    nivel: indice + 1,
    envase_id: Number(presentacion.envase_id),
    cantidad: Number(presentacion.cantidad),
  })).filter((presentacion) => (
    Number.isInteger(presentacion.envase_id) && presentacion.envase_id > 0 && presentacion.cantidad > 0
  ));
}

async function siguienteCodigoProducto() {
  const productos = await Producto.findAll({
    attributes: ['codigo'],
    where: { codigo: { [Op.iLike]: 'P-%' } },
  });
  const mayor = productos.reduce((maximo, producto) => {
    const numero = Number(producto.codigo.match(/^P-(\d+)$/i)?.[1] || 0);
    return Math.max(maximo, numero);
  }, 0);
  return `P-${String(mayor + 1).padStart(3, '0')}`;
}

function eliminarImagenSiExiste(file) {
  if (file?.path) fs.rmSync(path.resolve(file.path), { force: true });
}

const listar = async (req, res, next) => {
  try {
    const where = {};
    if (req.query.categoria_id) where.categoria_id = Number(req.query.categoria_id);
    if (req.query.marca_id) where.marca_id = Number(req.query.marca_id);
    if (req.query.activo !== undefined) where.activo = req.query.activo === 'true';
    if (req.query.search) {
      where[Op.or] = [
        { nombre: { [Op.iLike]: `%${req.query.search}%` } },
        { codigo: { [Op.iLike]: `%${req.query.search}%` } },
      ];
    }
    const productos = await Producto.findAll({
      where,
      include: [
        { model: Producto.sequelize.models.Categoria, as: 'categoria' },
        { model: Producto.sequelize.models.UnidadMedida, as: 'unidadMedida' },
        { model: Producto.sequelize.models.Presentacion, as: 'presentacion' },
        { model: Producto.sequelize.models.CatalogoMarca, as: 'marca' },
        { model: Producto.sequelize.models.Lote, as: 'lotes' }
      ]
    });
    const data = productos.map(p => {
      const dto = ProductoDto.fromModel(p);
      dto.stock_total = (p.lotes || []).reduce((s, l) => s + Number(l.cantidad_actual || 0), 0);
      return dto;
    });
    res.json({ data });
  } catch (error) { next(error); }
};

const obtener = async (req, res, next) => {
  try {
    const producto = await Producto.findByPk(req.params.id, {
      include: [
        { model: Producto.sequelize.models.Categoria, as: 'categoria' },
        { model: Producto.sequelize.models.UnidadMedida, as: 'unidadMedida' },
        { model: Producto.sequelize.models.Presentacion, as: 'presentacion' },
        { model: Producto.sequelize.models.CatalogoMarca, as: 'marca' },
        { model: Producto.sequelize.models.Lote, as: 'lotes' }
      ]
    });
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    const dto = ProductoDto.fromModel(producto);
    dto.stock_total = (producto.lotes || []).reduce((s, l) => s + Number(l.cantidad_actual || 0), 0);
    res.json({ data: dto });
  } catch (error) { next(error); }
};

const crear = async (req, res, next) => {
  let transaction;
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Datos inválidos', details: errors.array() });
    transaction = await Producto.sequelize.transaction();
    const presentaciones = parsePresentaciones(req.body.presentaciones_niveles);
    const data = ProductoDto.fromCreate({
      ...req.body,
      caracteristicas: parseCaracteristicas(req.body.caracteristicas),
      imagen: imagenGuardada(req.file),
    });
    data.codigo = await siguienteCodigoProducto();
    const producto = await Producto.create(data, { transaction });
    if (presentaciones.length) {
      await ProductoPresentacion.bulkCreate(
        presentaciones.map((presentacion) => ({ ...presentacion, producto_id: producto.id })),
        { transaction }
      );
    }
    await transaction.commit();
    res.status(201).json({ data: ProductoDto.fromModel(producto) });
  } catch (error) {
    if (transaction) await transaction.rollback();
    eliminarImagenSiExiste(req.file);
    next(error);
  }
};

const actualizar = async (req, res, next) => {
  try {
    const producto = await Producto.findByPk(req.params.id);
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    const data = ProductoDto.fromUpdate({
      ...req.body,
      caracteristicas: parseCaracteristicas(req.body.caracteristicas),
      ...(req.file ? { imagen: imagenGuardada(req.file) } : {}),
    });
    await producto.update(data);
    res.json({ data: ProductoDto.fromModel(producto) });
  } catch (error) { next(error); }
};

const desactivar = async (req, res, next) => {
  try {
    const producto = await Producto.findByPk(req.params.id);
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    const motivo = req.body.motivo_desactivacion;
    if (!motivo) return res.status(400).json({ error: 'Indica el motivo de desactivación' });
    producto.activo = false;
    producto.motivo_desactivacion = motivo;
    producto.motivo_desactivacion_detalle = req.body.motivo_desactivacion_detalle || '';
    producto.fecha_desactivacion = new Date();
    await producto.save();
    res.json({ data: ProductoDto.fromModel(producto) });
  } catch (error) { next(error); }
};

const activar = async (req, res, next) => {
  try {
    const producto = await Producto.findByPk(req.params.id);
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    producto.activo = true;
    producto.motivo_desactivacion = null;
    producto.motivo_desactivacion_detalle = null;
    producto.fecha_desactivacion = null;
    await producto.save();
    res.json({ data: ProductoDto.fromModel(producto) });
  } catch (error) { next(error); }
};

const ingreso = async (req, res, next) => {
  try {
    return res.status(400).json({
      error: 'El ingreso de stock debe hacerse creando un lote válido. Usa el flujo de registrar lote.',
    });
  } catch (error) { next(error); }
};

module.exports = { listar, obtener, crear, actualizar, desactivar, activar, ingreso };
