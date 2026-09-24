const { validationResult } = require('express-validator');
const { Producto, ProductoPresentacion, tipoEnvase } = require('../models');
const { ProductoPresentacionDto } = require('../dtos/ProductoPresentacionDto');

// Listar los niveles de empaque de un producto
const listarPorProducto = async (req, res, next) => {
  try {
    const { producto_id } = req.params;
    const presentaciones = await ProductoPresentacion.findAll({
      where: { producto_id },
      include: [{ model: tipoEnvase, as: 'envase' }],
      order: [['nivel', 'ASC']]
    });
    res.json({ data: presentaciones.map(p => ProductoPresentacionDto.fromModel(p)) });
  } catch (error) { next(error); }
};

// Crear un nuevo nivel de empaque para un producto (valida que no exista ese nivel)
const crear = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Datos inválidos', details: errors.array() });
    const { producto_id } = req.params;
    const producto = await Producto.findByPk(producto_id);
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });

    const data = ProductoPresentacionDto.fromCreate({ ...req.body, producto_id });
    const existente = await ProductoPresentacion.findOne({ where: { producto_id, nivel: data.nivel } });
    if (existente) {
      return res.status(409).json({ error: 'Ya existe ese nivel de empaque para este producto' });
    }
    const pp = await ProductoPresentacion.create(data);
    const creado = await ProductoPresentacion.findByPk(pp.id, { include: [{ model: tipoEnvase, as: 'envase' }] });
    res.status(201).json({ data: ProductoPresentacionDto.fromModel(creado) });
  } catch (error) { next(error); }
};

// Actualizar un nivel de empaque (cantidad o envase)
const actualizar = async (req, res, next) => {
  try {
    const { id } = req.params;
    const pp = await ProductoPresentacion.findByPk(id);
    if (!pp) return res.status(404).json({ error: 'Presentación de nivel no encontrada' });
    const data = {};
    if (req.body.nivel !== undefined) data.nivel = req.body.nivel;
    if (req.body.envase_id !== undefined) data.envase_id = req.body.envase_id;
    if (req.body.cantidad !== undefined) data.cantidad = req.body.cantidad;
    await pp.update(data);
    const actualizado = await ProductoPresentacion.findByPk(pp.id, { include: [{ model: tipoEnvase, as: 'envase' }] });
    res.json({ data: ProductoPresentacionDto.fromModel(actualizado) });
  } catch (error) { next(error); }
};

// Eliminar un nivel de empaque
const eliminar = async (req, res, next) => {
  try {
    const { id } = req.params;
    const pp = await ProductoPresentacion.findByPk(id);
    if (!pp) return res.status(404).json({ error: 'Presentación de nivel no encontrada' });
    await pp.destroy();
    res.status(204).send();
  } catch (error) { next(error); }
};

module.exports = { listarPorProducto, crear, actualizar, eliminar };