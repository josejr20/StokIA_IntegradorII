const { validationResult } = require('express-validator');
const { Venta } = require('../models');
const { VentaDto } = require('../dtos/ventaDto');
const { Lote, Producto } = require('../models');
const { registrarMovimiento } = require('../services/kardexService');
const { seleccionarLotesFEFO, diasHastaVencimiento } = require('../services/loteService');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

const listar = async (req, res, next) => {
  try {
    const { producto, fecha_venta, origen } = req.query;
    const where = {};
    if (producto) where.producto_id = producto;
    if (fecha_venta) where.fecha_venta = fecha_venta;
    if (origen) where.origen = origen;
    const ventas = await Venta.findAll({ where, include: [{ model: Producto, as: 'producto' }], order: [['fecha_venta', 'DESC']] });
    res.json({ data: ventas.map(v => VentaDto.fromModel(v)) });
  } catch (error) { next(error); }
};

const obtener = async (req, res, next) => {
  try {
    const venta = await Venta.findByPk(req.params.id);
    if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
    res.json({ data: VentaDto.fromModel(venta) });
  } catch (error) { next(error); }
};

const crear = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'Datos inválidos', details: errors.array() });

    const { producto_id, cantidad, precio_unitario, fecha_venta } = req.body;
    const cantidadVenta = Number(cantidad);
    if (!Number.isFinite(cantidadVenta) || cantidadVenta <= 0) {
      return res.status(400).json({ error: 'Cantidad inválida' });
    }

    const producto = await Producto.findByPk(producto_id);
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });

    const lotesDisponibles = seleccionarLotesFEFO(
      await Lote.findAll({
        where: { producto_id, cantidad_actual: { [Op.gt]: 0 } },
        order: [['fecha_vencimiento', 'ASC'], ['id', 'ASC']],
      })
    );

    const stockTotal = lotesDisponibles.reduce((sum, lote) => sum + Number(lote.cantidad_actual || 0), 0);
    if (stockTotal < cantidadVenta) {
      return res.status(400).json({ error: 'Stock insuficiente para realizar la venta' });
    }

    let restante = cantidadVenta;
    const ventasGeneradas = [];
    const precioVenta = Number(precio_unitario ?? producto.precio_venta ?? 0);

    for (const lote of lotesDisponibles) {
      if (restante <= 0) break;
      const disponible = Number(lote.cantidad_actual || 0);
      const cantidadAsignada = Math.min(disponible, restante);

      if (cantidadAsignada > 0) {
        const venta = await Venta.create({
          producto_id,
          lote_id: lote.id,
          cantidad: cantidadAsignada,
          precio_unitario: precioVenta,
          fecha_venta: fecha_venta || new Date(),
          origen: 'manual',
          usuario_id: req.user.id,
        });
        await registrarMovimiento(
          lote.id,
          'salida',
          cantidadAsignada,
          'venta',
          `Venta ${cantidadAsignada}`,
          precioVenta,
          req.user.id,
        );
        ventasGeneradas.push(venta);
        restante -= cantidadAsignada;
      }
    }

    if (restante > 0) {
      return res.status(400).json({ error: 'Stock insuficiente para realizar la venta' });
    }

    res.status(201).json({ data: ventasGeneradas.map((venta) => VentaDto.fromModel(venta)) });
  } catch (error) { next(error); }
};

const importar = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Adjunta un archivo excel o csv' });
    const path = req.file.path;
    const isCsv = path.endsWith('.csv');
    const readline = require('readline');
    const fs = require('fs');
    const stream = fs.createReadStream(path);
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    let headers = [];
    let procesadas = 0, errores = 0;
    let importacion = null;
    const productosCache = {};
    for await (const line of rl) {
      const fila = line.split(',');
      if (!headers.length) { headers = fila.map(h => h.trim()); continue; }
      const registro = {};
      headers.forEach((h, i) => registro[h] = fila[i]?.trim());
      try {
        if (!importacion) {
          importacion = await require('../models').ImportacionVenta.create({ usuario_id: req.user.id, nombre_archivo: req.file.originalname || 'importacion.csv', estado: 'procesando' });
        }
        const codigo = registro['codigo_producto'] || registro['codigo'];
        if (!productosCache[codigo]) {
          const producto = await Producto.findOne({ where: { codigo } });
          if (!producto) throw new Error('Producto no encontrado');
          productosCache[codigo] = producto;
        }
        const producto = productosCache[codigo];
        const cantidad = parseFloat(registro['cantidad']);
        const ventaData = {
          producto_id: producto.id,
          cantidad,
          precio_unitario: parseFloat(registro['precio_unitario']),
          fecha_venta: registro['fecha_venta'],
          origen: 'importado',
          usuario_id: req.user.id
        };
        await Venta.create(ventaData);
        procesadas++;
      } catch (e) { errores++; }
    }
    if (importacion) {
      importacion.filas_procesadas = procesadas;
      importacion.filas_con_error = errores;
      importacion.estado = 'completado';
      await importacion.save();
    }
    res.json({ data: { procesadas, errores } });
  } catch (error) { next(error); }
};

module.exports = { listar, obtener, crear, importar };
