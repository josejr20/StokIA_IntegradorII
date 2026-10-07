const { validationResult } = require('express-validator');
const XLSX = require('xlsx');
const crypto = require('crypto');
const logger = require('../utils/logger');
const { sequelize, Venta, ImportacionVenta } = require('../models');
const { VentaDto } = require('../dtos/ventaDto');
const { Producto } = require('../models');
const { ErrorOperacion, crearOperacion } = require('../services/operacionService');
const { Op } = require('sequelize');

const COLUMNAS_IMPORTACION = ['codigo_producto', 'cantidad', 'precio_unitario', 'fecha_venta'];
const MAXIMO_FILAS_IMPORTACION = 500;

const listar = async (req, res, next) => {
  try {
    const { producto, fecha_venta, fecha_desde, fecha_hasta, origen } = req.query;
    const where = {};
    if (producto) where.producto_id = producto;
    if (fecha_desde || fecha_hasta) {
      const range = {};
      if (fecha_desde) {
        const start = new Date(fecha_desde + 'T00:00:00.000Z');
        range[Op.gte] = start;
      }
      if (fecha_hasta) {
        const end = new Date(fecha_hasta + 'T23:59:59.999Z');
        range[Op.lte] = end;
      }
      where.fecha_venta = range;
    } else if (fecha_venta) {
      where.fecha_venta = fecha_venta;
    }
    if (origen) where.origen = origen;
    const ventas = await Venta.findAll({ where, include: [{ model: Producto, as: 'producto' }], order: [['fecha_venta', 'DESC']] });
    res.json({ data: ventas.map(v => VentaDto.fromModel(v)) });
  } catch (error) { next(error); }
};

const resumen = async (req, res, next) => {
  try {
    const { producto, fecha_desde, fecha_hasta, incluir_ajustes } = req.query;
    const where = {};
    if (producto) where.producto_id = producto;
    if (fecha_desde || fecha_hasta) {
      const range = {};
      if (fecha_desde) {
        const start = new Date(fecha_desde + 'T00:00:00.000Z');
        range[Op.gte] = start;
      }
      if (fecha_hasta) {
        const end = new Date(fecha_hasta + 'T23:59:59.999Z');
        range[Op.lte] = end;
      }
      where.fecha_venta = range;
    }
    // Por defecto, solo ventas netas (manual + importado). Si incluir_ajustes=true, suma devolucion y anulacion.
    const origenesPermitidos = incluir_ajustes === 'true'
      ? ['manual', 'importado', 'devolucion', 'anulacion']
      : ['manual', 'importado'];
    where.origen = { [Op.in]: origenesPermitidos };

    const result = await Venta.findAll({
      where,
      attributes: [
        [require('sequelize').fn('COALESCE', require('sequelize').fn('SUM', require('sequelize').col('cantidad')), 0), 'total_cantidad'],
        [require('sequelize').fn('COALESCE', require('sequelize').fn('SUM', require('sequelize').literal('cantidad * precio_unitario')), 0), 'total_monto'],
      ],
      raw: true,
    });
    const total_cantidad = Number(result[0]?.total_cantidad ?? 0);
    const total_monto = Number(result[0]?.total_monto ?? 0);
    res.json({ data: { total_cantidad, total_monto, origenes_incluidos: origenesPermitidos } });
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
  if (!req.file?.buffer) return res.status(400).json({ error: 'Adjunta un archivo CSV o Excel' });

  const archivo = req.file.buffer;
  const hashArchivo = crypto.createHash('sha256').update(archivo).digest('hex');
  let importacion;

  try {
    const existente = await ImportacionVenta.findOne({ where: { hash_archivo: hashArchivo } });
    if (existente) return res.status(409).json({ error: 'Este archivo ya fue importado' });

    importacion = await ImportacionVenta.create({
      usuario_id: req.user.id,
      nombre_archivo: req.file.originalname || 'importacion',
      hash_archivo: hashArchivo,
      estado: 'procesando',
    });

    let workbook;
    try {
      workbook = XLSX.read(archivo, { type: 'buffer', cellDates: true });
    } catch {
      await importacion.update({
        estado: 'fallido',
        filas_con_error: 1,
        detalle_errores: [{ fila: 0, codigo: '', motivo: 'El archivo no es un CSV o Excel válido' }],
      });
      return res.status(400).json({ error: 'El archivo no es un CSV o Excel válido' });
    }

    const sheetName = workbook.SheetNames[0];
    const sheet = sheetName && workbook.Sheets[sheetName];
    const filas = sheet
      ? XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true })
      : [];
    const encabezados = Array.isArray(filas[0])
      ? filas[0].map((value) => String(value ?? '').replace(/^\uFEFF/, '').trim().toLowerCase())
      : [];
    const columnasFaltantes = COLUMNAS_IMPORTACION.filter((columna) => !encabezados.includes(columna));

    if (columnasFaltantes.length) {
      await importacion.update({
        estado: 'fallido',
        filas_con_error: 1,
        detalle_errores: [{ fila: 1, codigo: '', motivo: `Faltan columnas: ${columnasFaltantes.join(', ')}` }],
      });
      return res.status(400).json({
        error: 'Faltan columnas requeridas',
        columnas_faltantes: columnasFaltantes,
        importacion_id: importacion.id,
      });
    }

    const indices = Object.fromEntries(COLUMNAS_IMPORTACION.map((columna) => [columna, encabezados.indexOf(columna)]));
    const filasDatos = filas
      .slice(1)
      .map((valores, indice) => ({ valores, fila: indice + 2 }))
      .filter(({ valores }) => valores.some((value) => String(value ?? '').trim() !== ''));

    if (filasDatos.length > MAXIMO_FILAS_IMPORTACION) {
      await importacion.update({
        estado: 'fallido',
        filas_con_error: filasDatos.length,
        detalle_errores: [{ fila: 0, codigo: '', motivo: `El archivo supera el máximo de ${MAXIMO_FILAS_IMPORTACION} filas` }],
      });
      return res.status(400).json({ error: `El archivo no puede superar ${MAXIMO_FILAS_IMPORTACION} filas` });
    }
    if (filasDatos.length === 0) {
      await importacion.update({ estado: 'fallido' });
      return res.status(400).json({ error: 'El archivo no contiene filas de ventas' });
    }

    const errores = [];
    const candidatas = [];
    for (const { valores, fila } of filasDatos) {
      const codigo = String(valores[indices.codigo_producto] ?? '').trim();
      const cantidadRaw = valores[indices.cantidad];
      const precioRaw = valores[indices.precio_unitario];
      const fechaRaw = valores[indices.fecha_venta];
      const cantidad = cantidadRaw === '' || cantidadRaw == null ? Number.NaN : Number(cantidadRaw);
      const precioUnitario = precioRaw === '' || precioRaw == null ? Number.NaN : Number(precioRaw);
      const fechaVenta = parsearFechaVenta(fechaRaw);
      const motivos = [];

      if (!codigo) motivos.push('Falta el código del producto');
      if (!Number.isFinite(cantidad) || cantidad <= 0) motivos.push('La cantidad debe ser mayor a 0');
      if (!Number.isFinite(precioUnitario) || precioUnitario < 0) motivos.push('El precio unitario debe ser mayor o igual a 0');
      if (!fechaVenta || Number.isNaN(fechaVenta.getTime())) motivos.push('La fecha de venta no es válida');
      else if (fechaVenta.getTime() > Date.now()) motivos.push('La fecha de venta no puede ser futura');

      if (motivos.length) errores.push({ fila, codigo, motivo: motivos.join('; ') });
      else candidatas.push({ fila, codigo, cantidad, precioUnitario, fechaVenta });
    }

    const codigos = [...new Set(candidatas.map((fila) => fila.codigo))];
    const productos = codigos.length
      ? await Producto.findAll({ where: { codigo: { [Op.in]: codigos } } })
      : [];
    const productosPorCodigo = new Map(productos.map((producto) => [producto.codigo, producto]));
    const ventas = [];

    for (const fila of candidatas) {
      const producto = productosPorCodigo.get(fila.codigo);
      let motivo;
      if (!producto) motivo = 'Producto no encontrado';
      else if (!producto.activo) motivo = 'Producto inactivo';

      if (motivo) {
        errores.push({ fila: fila.fila, codigo: fila.codigo, motivo });
        continue;
      }

      ventas.push({
        producto_id: producto.id,
        cantidad: fila.cantidad,
        precio_unitario: fila.precioUnitario,
        fecha_venta: fila.fechaVenta,
        origen: 'importado',
        usuario_id: req.user.id,
      });
    }
    errores.sort((a, b) => a.fila - b.fila);

    const tx = await sequelize.transaction();
    try {
      // El historial importado no pasa por crearOperacion para no descontar el stock actual.
      if (ventas.length) await Venta.bulkCreate(ventas, { transaction: tx });
      await importacion.update({
        filas_procesadas: ventas.length,
        filas_con_error: errores.length,
        detalle_errores: errores,
        estado: ventas.length ? 'completado' : 'fallido',
      }, { transaction: tx });
      await tx.commit();
    } catch (error) {
      await tx.rollback();
      const filasFallidas = new Set(errores.map((fila) => fila.fila));
      const erroresGuardado = [
        ...errores,
        ...candidatas
          .filter((fila) => !filasFallidas.has(fila.fila))
          .map((fila) => ({ fila: fila.fila, codigo: fila.codigo, motivo: 'No se pudo guardar la importación' })),
      ];
      try {
        await importacion.update({
          filas_procesadas: 0,
          filas_con_error: erroresGuardado.length,
          detalle_errores: erroresGuardado,
          estado: 'fallido',
        });
      } catch (updateError) {
        logger.error(`No se pudo marcar como fallida la importación ${importacion.id}: ${updateError.message}`);
      }
      throw error;
    }

    res.json({
      importacion_id: importacion.id,
      total: filasDatos.length,
      procesadas: ventas.length,
      rechazadas: errores.length,
      errores,
    });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError' || error.original?.code === '23505') {
      return res.status(409).json({ error: 'Este archivo ya fue importado' });
    }
    logger.error(`Error importando ventas${importacion ? ` (importación ${importacion.id})` : ''}: ${error.message}`);
    if (importacion?.estado === 'procesando') {
      try {
        await importacion.update({
          estado: 'fallido',
          filas_con_error: Math.max(importacion.filas_con_error || 0, 1),
          detalle_errores: [{ fila: 0, codigo: '', motivo: 'Error al procesar el archivo' }],
        });
      } catch (updateError) {
        logger.error(`No se pudo marcar como fallida la importación ${importacion.id}: ${updateError.message}`);
      }
    }
    next(error);
  }
};

function parsearFechaVenta(valor) {
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
  if (typeof valor === 'number') {
    const partes = XLSX.SSF.parse_date_code(valor);
    if (!partes) return null;
    return new Date(Date.UTC(partes.y, partes.m - 1, partes.d, partes.H, partes.M, Math.floor(partes.S)));
  }

  const texto = String(valor ?? '').trim();
  if (!texto) return null;
  const formatoIso = texto.match(/^(\d{4})-(\d{2})-(\d{2})(.*)$/);
  if (formatoIso) {
    const [, anio, mes, dia, resto] = formatoIso;
    const fechaDia = new Date(Date.UTC(Number(anio), Number(mes) - 1, Number(dia)));
    if (fechaDia.getUTCFullYear() !== Number(anio)
      || fechaDia.getUTCMonth() !== Number(mes) - 1
      || fechaDia.getUTCDate() !== Number(dia)) return null;
    if (!resto) return fechaDia;
    const timestampIso = Date.parse(texto);
    return Number.isNaN(timestampIso) ? null : new Date(timestampIso);
  }
  const formatoLocal = texto.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (formatoLocal) {
    const [, dia, mes, anio] = formatoLocal;
    const fecha = new Date(Date.UTC(Number(anio), Number(mes) - 1, Number(dia)));
    if (fecha.getUTCFullYear() !== Number(anio)
      || fecha.getUTCMonth() !== Number(mes) - 1
      || fecha.getUTCDate() !== Number(dia)) return null;
    return fecha;
  }
  const timestamp = Date.parse(texto);
  return Number.isNaN(timestamp) ? null : new Date(timestamp);
}

module.exports = { listar, obtener, crear, importar, resumen, parsearFechaVenta, MAXIMO_FILAS_IMPORTACION };
