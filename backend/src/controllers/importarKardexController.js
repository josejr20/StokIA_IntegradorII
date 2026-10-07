/**
 * Import kardex operations from Excel file
 * Handles historical operations with proper stock management
 */
const XLSX = require('xlsx');
const { validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const { sequelize } = require('../models');
const { Cliente, Usuario, Operacion, OperacionDetalle, Producto, Venta } = require('../models');
const { EMPLOYEE_MAP, PRESENTATION_TO_PRODUCT } = require('../config/kardexMappings');
const {
  crearOperacion,
  buscarVentaOrigenDevolucion,
} = require('../services/operacionService');
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

function fechaDesdeExcel(valor) {
  if (valor instanceof Date) return new Date(valor);
  if (typeof valor === 'number') {
    const partes = XLSX.SSF.parse_date_code(valor);
    if (!partes) return new Date(Number.NaN);
    return new Date(Date.UTC(partes.y, partes.m - 1, partes.d, partes.H, partes.M, Math.floor(partes.S)));
  }
  return new Date(valor);
}

async function processRow(row, transaction, usuarioImportadorId) {
  const [, fcreacion, empleado, clienteNombre, presentacion, observaciones, motivo, cantidad] = row;
  const productoId = PRESENTATION_TO_PRODUCT[presentacion];
  if (productoId === null || productoId === undefined) {
    return { skipped: true, reason: 'no_product_mapping', presentacion };
  }

  const fecha = fechaDesdeExcel(fcreacion);
  if (Number.isNaN(fecha.getTime())) throw new Error('La fecha de la fila no es válida');
  const cantidadOperacion = Math.abs(Number(cantidad));
  if (!Number.isFinite(cantidadOperacion) || cantidadOperacion <= 0) {
    throw new Error('La cantidad de la fila debe ser mayor a 0');
  }
  const motivoNormalizado = String(motivo || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const esDevolucion = motivoNormalizado.includes('devolucion') && motivoNormalizado.includes('ingreso');
  const esVenta = motivoNormalizado.includes('venta') && motivoNormalizado.includes('salida');
  if (!esDevolucion && !esVenta) {
    throw new Error('El motivo de la fila no identifica una salida de venta ni un ingreso por devolución');
  }

  const tipo = esDevolucion ? 'devolucion' : 'venta';
  const motivoOperacion = [
    String(observaciones || motivo || 'Importación histórica').trim(),
    empleado ? `Empleado histórico: ${String(empleado).trim()}` : '',
  ].filter(Boolean).join(' | ');
  const idempotencyKey = `KX-${crypto.createHash('sha256').update(JSON.stringify(row)).digest('hex').slice(0, 61)}`;
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

const importarKardex = async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió archivo' });
  }

  const filePath = req.file.path;
  let wb;
  
  try {
    wb = XLSX.readFile(filePath);
  } catch (e) {
    fs.unlinkSync(filePath);
    return res.status(400).json({ error: 'Archivo Excel inválido' });
  }

  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  
  fs.unlinkSync(filePath);
  
  if (rows.length <= 1) {
    return res.status(400).json({ error: 'El archivo no tiene datos' });
  }
  
  // Process by effective date so opening stock and returns follow ledger chronology.
  const dataRows = rows.slice(1).filter(r => r[0]);
  dataRows.sort((a, b) => fechaDesdeExcel(a[1]).getTime() - fechaDesdeExcel(b[1]).getTime());
  
  let created = 0, skipped = 0, errors = 0;
  const errorDetails = [];
  
  for (const row of dataRows) {
    const transaction = await sequelize.transaction();
    try {
      const result = await processRow(row, transaction, req.user.id);
      await transaction.commit();
      
      if (result.skipped) {
        skipped++;
        errorDetails.push({ row: row[0], presentacion: result.presentacion, reason: result.reason });
      } else if (result.repetida) {
        skipped++;
        errorDetails.push({ row: row[0], reason: 'already_imported' });
      } else {
        created++;
      }
    } catch (error) {
      await transaction.rollback();
      errors++;
      errorDetails.push({ row: row[0], error: error.message });
      logger.error(`Row ${row[0]} ERROR: ${error.message}`);
    }
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

module.exports = { importarKardex, upload };