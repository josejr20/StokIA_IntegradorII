/**
 * Import kardex operations from Excel file
 */
const XLSX = require('xlsx');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const { sequelize } = require('../models');
const { Cliente, Usuario, Operacion, OperacionDetalle, Producto, Venta, Lote } = require('../models');
const { EMPLOYEE_MAP, PRESENTATION_TO_PRODUCT } = require('../config/kardexMappings');
const {
  crearOperacion,
  buscarVentaOrigenDevolucion,
} = require('../services/operacionService');
const { registrarMovimiento } = require('../services/kardexService');
const {
  clasificarMotivo,
  crearIndiceProductos,
  limitarMotivo,
  obtenerProductoId,
  prioridadMotivo,
} = require('../utils/importarKardex');
const logger = require('../utils/logger');

const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Solo archivos Excel (.xlsx, .xls) son permitidos'));
    }
  }
});

const PREVIEW_DIR = path.join(__dirname, '../../uploads/kardex-preview');
if (!fs.existsSync(PREVIEW_DIR)) {
  fs.mkdirSync(PREVIEW_DIR, { recursive: true });
}

async function findOrCreateClient(nombre, transaction) {
  const trimmed = nombre.trim();
  let cliente = await Cliente.findOne({ where: { nombre: trimmed }, transaction });
  if (!cliente) {
    cliente = await Cliente.create({ nombre: trimmed, documento: null, activo: true }, { transaction });
    logger.info(`Created client: ${cliente.id} ${trimmed}`);
  }
  return cliente;
}

async function resolveEmployee(nombre, transaction, usuarioImportadorId) {
  const trimmed = nombre.trim();
  if (EMPLOYEE_MAP[trimmed]) {
    const usuario = await Usuario.findByPk(EMPLOYEE_MAP[trimmed], { transaction });
    if (usuario) return usuario;
  }
  const existing = await Usuario.findOne({
    where: sequelize.where(sequelize.fn('TRIM', sequelize.col('nombres')), trimmed),
    transaction
  });
  if (existing) return existing;
  const usuarioImportador = await Usuario.findByPk(usuarioImportadorId, { transaction });
  if (!usuarioImportador) throw new Error('No se encontró el usuario que inició la importación');
  return usuarioImportador;
}

async function cargarIndiceProductos() {
  const productos = await Producto.findAll({
    attributes: ['id', 'nombre', 'descripcion'],
  });
  return crearIndiceProductos(productos, PRESENTATION_TO_PRODUCT);
}

async function actualizarAlertasStock(productoIds) {
  const { evaluarAlertasStockMinimo } = require('../services/stockMinimoService');
  for (const productoId of productoIds) {
    try {
      await evaluarAlertasStockMinimo(productoId);
    } catch (error) {
      logger.warn(`No se pudo actualizar la alerta de stock del producto ${productoId}: ${error.message}`);
    }
  }
}

const sortRows = (a, b) => {
  const diff = fechaDesdeExcel(a[1]).getTime() - fechaDesdeExcel(b[1]).getTime();
  if (diff !== 0) return diff;
  return prioridadMotivo(a[6]) - prioridadMotivo(b[6]);
};

function fechaDesdeExcel(valor) {
  if (typeof valor === 'number') {
    const partes = XLSX.SSF.parse_date_code(valor);
    if (!partes) return new Date(Number.NaN);
    return new Date(Date.UTC(partes.y, partes.m - 1, partes.d, partes.H, partes.M, Math.floor(partes.S)));
  }
  return new Date(valor);
}

async function processRow(row, transaction, usuarioImportadorId, indiceProductos) {
  const [, fcreacion, empleado, clienteNombre, presentacion, observaciones, motivo, cantidad] = row;
  const resultadoProducto = obtenerProductoId(presentacion, indiceProductos);
  const productoId = resultadoProducto.productoId;
  if (productoId === null || productoId === undefined) {
    if (resultadoProducto.ambiguo) {
      throw new Error(`La presentación "${presentacion}" coincide con más de un producto`);
    }
    return { skipped: true, reason: 'no_product_mapping', presentacion };
  }

  const fecha = fechaDesdeExcel(fcreacion);
  if (Number.isNaN(fecha.getTime())) throw new Error('La fecha de la fila no es válida');
  const cantidadOperacion = Math.abs(Number(cantidad));
  if (!Number.isFinite(cantidadOperacion) || cantidadOperacion <= 0) {
    throw new Error('La cantidad de la fila debe ser mayor a 0');
  }
  const tipoMovimiento = clasificarMotivo(motivo);
  if (!tipoMovimiento) {
    throw new Error('El motivo de la fila no identifica una salida de venta, un ingreso por devolución ni un ingreso por compra');
  }
  const esDevolucion = tipoMovimiento === 'devolucion';
  const esCompra = tipoMovimiento === 'compra';

  const motivoOperacion = limitarMotivo([
    String(observaciones || motivo || 'Importación histórica').trim(),
    empleado ? `Empleado histórico: ${String(empleado).trim()}` : '',
  ].filter(Boolean).join(' | '));
  const hashFila = crypto.createHash('sha256').update(JSON.stringify(row)).digest('hex');
  const idempotencyKey = `KX-${hashFila.slice(0, 61)}`;

  if (esCompra) {
    const producto = await Producto.findByPk(productoId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!producto) throw new Error(`No se encontró el producto ${productoId} para registrar la compra`);
    const precioUnitario = Number(producto.precio_venta) || 0;

    const numeroLote = `KX-${hashFila.slice(0, 56)}`;
    const loteExistente = await Lote.findOne({
      where: { producto_id: productoId, numero_lote: numeroLote },
      transaction,
    });
    if (loteExistente) return { repetida: true };

    const usuario = await resolveEmployee(empleado, transaction, usuarioImportadorId);
    const lote = await Lote.create({
      producto_id: productoId,
      numero_lote: numeroLote,
      cantidad_inicial: cantidadOperacion,
      cantidad_actual: 0,
      fecha_ingreso: fecha,
      fecha_vencimiento: null,
    }, { transaction });

    await registrarMovimiento(
      lote.id,
      'ingreso',
      cantidadOperacion,
      'compra',
      motivoOperacion,
      precioUnitario,
      usuario.id,
      transaction,
      fecha,
    );
    return {};
  }

  const tipo = esDevolucion ? 'devolucion' : 'venta';
  const operacionExistente = await Operacion.findOne({
    where: { idempotency_key: idempotencyKey },
    transaction,
  });
  if (operacionExistente) return { repetida: true };

  const cliente = await findOrCreateClient(clienteNombre, transaction);
  const usuario = await resolveEmployee(empleado, transaction, usuarioImportadorId);
  let operacionOrigenId = null;
  const producto = await Producto.findByPk(productoId, { transaction });
  if (!producto) throw new Error(`No se encontró el producto ${productoId} para completar el comprobante`);
  let precioUnitario = Number(producto.precio_venta) || 0;
  if (esDevolucion) {
    const ventaOrigen = await buscarVentaOrigenDevolucion({
      cliente_id: cliente.id,
      producto_id: productoId,
      cantidad: cantidadOperacion,
      fecha,
      transaction,
    });
    operacionOrigenId = ventaOrigen.id;
    const [detallesOrigen, ventasOrigen] = await Promise.all([
      OperacionDetalle.findAll({
        where: { operacion_id: ventaOrigen.id, producto_id: productoId },
        transaction,
      }),
      Venta.findAll({
        where: { operacion_id: ventaOrigen.id, producto_id: productoId },
        transaction,
      }),
    ]);
    const detalleOrigen = detallesOrigen.find((detalle) => Number(detalle.precio_unitario) > 0);
    const ventaConPrecio = ventasOrigen.find((venta) => Number(venta.precio_unitario) > 0);
    precioUnitario = Number(
      detalleOrigen?.precio_unitario
      ?? ventaConPrecio?.precio_unitario
      ?? producto.precio_venta
      ?? 0,
    );
  }

  return crearOperacion({
    tipo,
    cliente_id: cliente.id,
    items: [{ producto_id: productoId, cantidad: cantidadOperacion, precio_unitario: precioUnitario }],
    fecha,
    motivo: motivoOperacion,
    operacion_origen_id: operacionOrigenId,
    idempotency_key: idempotencyKey,
    usuario_id: usuario.id,
    habilitarStockInicial: tipo === 'venta',
    origenVenta: 'importado',
    transaction,
  });
}

const previsualizarKardex = async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió archivo' });
  }

  const filePath = req.file.path;
  let wb;

  try {
    wb = XLSX.readFile(filePath);
  } catch (e) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return res.status(400).json({ error: 'Archivo Excel inválido' });
  }

  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  if (rows.length <= 1) {
    return res.status(400).json({ error: 'El archivo no tiene datos' });
  }

  const dataRows = rows.slice(1).filter(r => r[0]);
  dataRows.sort(sortRows);

  const indiceProductos = await cargarIndiceProductos();
  const previewRows = [];
  const clientesSet = new Set();
  const productosNoMapeados = new Set();

  for (let idx = 0; idx < dataRows.length; idx++) {
    const row = dataRows[idx];
    const [, fcreacion, empleado, clienteNombre, presentacion, observaciones, motivo, cantidad] = row;
    const filaNumero = row[0] || idx + 2;
    const item = {
      fila: filaNumero,
      fecha: null,
      empleado: empleado ? String(empleado).trim() : '',
      cliente: clienteNombre ? String(clienteNombre).trim() : '',
      presentacion: presentacion ? String(presentacion).trim() : '',
      observaciones: observaciones ? String(observaciones).trim() : '',
      motivo: motivo ? String(motivo).trim() : '',
      cantidad: cantidad,
      tipo: null,
      productoId: null,
      estado: 'OK',
      errores: [],
      clienteNuevo: false
    };

    try {
      const fecha = fechaDesdeExcel(fcreacion);
      if (Number.isNaN(fecha.getTime())) {
        throw new Error('La fecha de la fila no es válida');
      }
      item.fecha = fecha.toISOString();

      const cantidadOperacion = Math.abs(Number(cantidad));
      if (!Number.isFinite(cantidadOperacion) || cantidadOperacion <= 0) {
        throw new Error('La cantidad de la fila debe ser mayor a 0');
      }

      const resultadoProducto = obtenerProductoId(presentacion, indiceProductos);
      if (resultadoProducto.productoId === null || resultadoProducto.productoId === undefined) {
        productosNoMapeados.add(String(presentacion).trim());
        throw new Error(resultadoProducto.ambiguo
          ? 'La presentación coincide con más de un producto'
          : 'Presentación no mapeada a ningún producto');
      }
      item.productoId = resultadoProducto.productoId;

      const tipo = clasificarMotivo(motivo);
      if (!tipo) {
        throw new Error('El motivo de la fila no identifica una salida de venta, un ingreso por devolución ni un ingreso por compra');
      }
      item.tipo = tipo;

      if (item.tipo !== 'compra') {
        if (item.cliente) {
          clientesSet.add(item.cliente);
        } else {
          throw new Error('Cliente es obligatorio para ventas y devoluciones');
        }
      }
    } catch (error) {
      item.estado = 'ERROR';
      item.errores.push(error.message);
    }

    previewRows.push(item);
  }

  let clientesExistentes = [];
  if (clientesSet.size > 0) {
    const nombres = Array.from(clientesSet);
    const existentes = await Cliente.findAll({
      where: { nombre: nombres },
      attributes: ['nombre']
    });
    clientesExistentes = existentes.map(c => c.nombre.trim());
  }

  const clientesNuevos = Array.from(clientesSet).filter(c => !clientesExistentes.includes(c));

  for (const pr of previewRows) {
    if (pr.cliente && clientesNuevos.includes(pr.cliente)) {
      pr.clienteNuevo = true;
    }
  }

  const total = previewRows.length;
  const validas = previewRows.filter(r => r.estado === 'OK').length;
  const conError = previewRows.filter(r => r.estado === 'ERROR').length;
  const devoluciones = previewRows.filter(r => r.estado === 'OK' && r.tipo === 'devolucion').length;
  const ventas = previewRows.filter(r => r.estado === 'OK' && r.tipo === 'venta').length;
  const compras = previewRows.filter(r => r.estado === 'OK' && r.tipo === 'compra').length;

  const previewId = crypto.randomUUID();
  const previewPath = path.join(PREVIEW_DIR, `${previewId}.json`);
  fs.writeFileSync(previewPath, JSON.stringify({
    usuarioId: req.user.id,
    createdAt: new Date().toISOString(),
    rows: dataRows,
    previewRows
  }, null, 2));

  res.json({
    data: {
      previewId,
      total,
      validas,
      conError,
      devoluciones,
      ventas,
      compras,
      clientesNuevos,
      productosNoMapeados: Array.from(productosNoMapeados),
      filas: previewRows
    }
  });
};

const confirmarKardex = async (req, res, next) => {
  const { previewId } = req.body;
  if (!previewId) {
    return res.status(400).json({ error: 'Falta previewId para confirmar la importación' });
  }

  const previewPath = path.join(PREVIEW_DIR, `${previewId}.json`);
  if (!fs.existsSync(previewPath)) {
    return res.status(404).json({ error: 'Previsualización no encontrada o expirada' });
  }

  let previewData;
  try {
    previewData = JSON.parse(fs.readFileSync(previewPath, 'utf8'));
  } catch (e) {
    return res.status(400).json({ error: 'Previsualización inválida' });
  }

  if (previewData.usuarioId !== req.user.id) {
    return res.status(403).json({ error: 'No autorizado para confirmar esta importación' });
  }

  const dataRows = previewData.rows || [];
  const indiceProductos = await cargarIndiceProductos();
  const productosModificados = new Set();
  let created = 0, skipped = 0, errors = 0;
  const errorDetails = [];

  for (const row of dataRows) {
    const transaction = await sequelize.transaction();
    try {
      const result = await processRow(row, transaction, req.user.id, indiceProductos);
      await transaction.commit();

      if (result.skipped) {
        skipped++;
        errorDetails.push({ row: row[0], presentacion: result.presentacion, reason: result.reason });
      } else if (result.repetida) {
        skipped++;
        errorDetails.push({ row: row[0], reason: 'already_imported' });
      } else {
        created++;
        const producto = obtenerProductoId(row[4], indiceProductos);
        if (producto.productoId !== null && producto.productoId !== undefined) {
          productosModificados.add(producto.productoId);
        }
      }
    } catch (error) {
      await transaction.rollback();
      errors++;
      errorDetails.push({ row: row[0], error: error.message });
      logger.error(`Row ${row[0]} ERROR: ${error.message}`);
    }
  }

  await actualizarAlertasStock(productosModificados);

  try {
    fs.unlinkSync(previewPath);
  } catch (e) {
    // ignore
  }

  res.json({
    data: {
      total_rows: dataRows.length,
      created,
      skipped,
      errors,
      error_details: errorDetails.slice(0, 50)
    }
  });
};

const importarKardex = async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió archivo' });
  }

  const filePath = req.file.path;
  let wb;
  
  try {
    wb = XLSX.readFile(filePath);
  } catch (e) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return res.status(400).json({ error: 'Archivo Excel inválido' });
  }

  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  
  if (rows.length <= 1) {
    return res.status(400).json({ error: 'El archivo no tiene datos' });
  }
  
  // Process by effective date so opening stock and returns follow ledger chronology.
  const dataRows = rows.slice(1).filter(r => r[0]);
  dataRows.sort(sortRows);
  const indiceProductos = await cargarIndiceProductos();
  const productosModificados = new Set();
  
  let created = 0, skipped = 0, errors = 0;
  const errorDetails = [];
  
  for (const row of dataRows) {
    const transaction = await sequelize.transaction();
    try {
      const result = await processRow(row, transaction, req.user.id, indiceProductos);
      await transaction.commit();
      
      if (result.skipped) {
        skipped++;
        errorDetails.push({ row: row[0], presentacion: result.presentacion, reason: result.reason });
      } else if (result.repetida) {
        skipped++;
        errorDetails.push({ row: row[0], reason: 'already_imported' });
      } else {
        created++;
        const producto = obtenerProductoId(row[4], indiceProductos);
        if (producto.productoId !== null && producto.productoId !== undefined) {
          productosModificados.add(producto.productoId);
        }
      }
    } catch (error) {
      await transaction.rollback();
      errors++;
      errorDetails.push({ row: row[0], error: error.message });
      logger.error(`Row ${row[0]} ERROR: ${error.message}`);
    }
  }

  await actualizarAlertasStock(productosModificados);
  
  res.json({
    data: {
      total_rows: dataRows.length,
      created,
      skipped,
      errors,
      error_details: errorDetails.slice(0, 50)
    }
  });
};

module.exports = { importarKardex, previsualizarKardex, confirmarKardex, upload };