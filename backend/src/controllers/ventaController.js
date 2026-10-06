const { validationResult } = require('express-validator');
const { Venta } = require('../models');
const { VentaDto } = require('../dtos/ventaDto');
const { Producto } = require('../models');
const { ErrorOperacion, crearOperacion } = require('../services/operacionService');

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

    const { producto_id, cantidad, precio_unitario, fecha_venta, cliente_id, idempotency_key } = req.body;
    if (!cliente_id) return res.status(400).json({ error: 'Debe seleccionar un cliente para la venta' });
    const resultado = await crearOperacion({
      tipo: 'venta',
      cliente_id: Number(cliente_id),
      items: [{ producto_id: Number(producto_id), cantidad, precio_unitario }],
      fecha: fecha_venta ? new Date(fecha_venta) : null,
      idempotency_key,
      usuario_id: req.user.id,
    });
    const ventasGeneradas = await Venta.findAll({ where: { operacion_id: resultado.operacion.id } });
    res.status(resultado.repetida ? 200 : 201).json({
      data: ventasGeneradas.map((venta) => VentaDto.fromModel(venta)),
      operacion: resultado.operacion,
      repetida: resultado.repetida,
    });
  } catch (error) {
    if (error instanceof ErrorOperacion) return res.status(400).json({ error: error.message });
    next(error);
  }
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
