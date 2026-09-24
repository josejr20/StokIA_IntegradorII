const { Op } = require('sequelize');
const { validationResult } = require('express-validator');
const { Producto, Precio } = require('../models');
const { PrecioDto } = require('../dtos/PrecioDto');

// Listar histórico de precios de un producto
const listarPorProducto = async (req, res, next) => {
  try {
    const { producto_id } = req.params;
    const precios = await Precio.findAll({
      where: { producto_id },
      order: [['vigente_desde', 'DESC']]
    });
    res.json({ data: precios.map(p => PrecioDto.fromModel(p)) });
  } catch (error) { next(error); }
};

// Obtener el precio vigente (el más reciente con vigente_desde <= hoy)
const vigente = async (req, res, next) => {
  try {
    const { producto_id } = req.params;
    const precio = await Precio.findOne({
      where: { producto_id, vigente_desde: { [Op.lte]: new Date() } },
      order: [['vigente_desde', 'DESC']]
    });
    if (!precio) return res.status(404).json({ error: 'No hay precio vigente para este producto' });
    res.json({ data: PrecioDto.fromModel(precio) });
  } catch (error) { next(error); }
};

// Crear un nuevo precio (historial)
const crear = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Datos inválidos', details: errors.array() });
    const { producto_id } = req.params;
    const producto = await Producto.findByPk(producto_id);
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });

    const data = PrecioDto.fromCreate({ ...req.body, producto_id });
    const precio = await Precio.create(data);
    res.status(201).json({ data: PrecioDto.fromModel(precio) });
  } catch (error) { next(error); }
};

module.exports = { listarPorProducto, vigente, crear };