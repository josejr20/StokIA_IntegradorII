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

const EMPLOYEE_MAP = {
  'YVETT KATTERINE ': 10,
  'CLAUDIA': 1,
  'MAXIMO': 3,
  'VICTOR HUMBERTO': 7,
};

const PRESENTATION_TO_PRODUCT = {
  'AJI-NO-MOTO GMS 90 GR X20 SOBRES/SACO X8 PAQUETES': 38,
  'AJI-NO-MOTO GMS 34 GR X20 SOBRES (S/ 1.00)/SACO X20 PAQUETES': 26,
  'AJI-NO-MOTO GMS 53 GR X20 SOBRES (S/ 1.50)/SACO X12 PAQUETES': 27,
  'SIB SAZONADOR SIN PCTE GIG X42 SOB 32.4 GR/PAQUETE X12 DISLPLAY': 89,
  'VINAGRE DEL FIRME BLANCO BOT 1 LT/PAQUETE X12 UND': 87,
  'VINAGRE DEL FIRME TINTO BOT 1 LT/PAQUETE X12 UND': 92,
  'VINAGRE DEL FIRME TINTO BOT 125 ML X12 UND/PLANCH X4 PAQ': 94,
  'SIB TUCO TALLARIN GIG X42 SOB 32.4 GR/PAQUETE X12 DISPLAY': 93,
  'GMS MAX SABOR 1 KG/SACO X25 UND': 39,
  'COMINO MOLIDO A GRANEL': 69,
  'PIMIENTA MOLIDO A GRANEL': 80,
  'ROMERO MOLIDO A GRANEL': null,
  'SIB OREGANO ECON X66 SOB 3.5 GR/PAQUETE X25 DISPLAY': 76,
  'AJI-NO-MOTO GMS 1 KG/SACO X18 UND': 25,
  'VINAGRE VALLE VERDE TINTO BOT 1 LT/PAQUETE X12 UND': 100,
  'AJI-NO-MOTO GMS 16 GR X30 SOBRES (S/ 0.50)/SACO X24 PAQUETES': 28,
  'AJI-NO-MEN GALLINA 80 GR X24 SOBRES': 14,
  'DOÑA GUSTA GALLINA 7 GR X10 SOBRES/BLS X8 TIRA(S)/CAJA X80 TIRA(S)': 46,
  'SIB COMINO CON PIMIENTA ECON X66 SOB 5 GR/PAQUETE X12 DISPLAY': 67,
  'SIB PIMIENTA GIG X50 SOB 10 GR/PAQUETE X12 DISPLAY': 81,
  'AJI-NO-SILLAO BOTELLA 280 ML X6 UND/CAJA X8 PAQUETES': 39,
  'AJI-NO-MEN POLLO 80 GR X24 SOBRES': 16,
  'AJI-NO-MIX ABLANDA SAZON 11 GR X10 SOBRES/BLS X8 TIRA(S)/CAJA X48 TIRA(S)': 20,
  'SIB PALILLO AMARILLITO GIG X42 SOB 32.4 GR/PAQUETE X12 DIPLAY': 79,
  'SIB SAZONADOR SIN PCTE ECON X84 SOB 9.5 GR/PAQUETE X12 DISPLAY': 88,
  'AJI-NO-MIX CROCANTE X96 GR/BLS X15 UND/CAJA X60 UND': 23,
  'VINAGRE DEL FIRME BLANCO BOT 125 ML X12 UND/PLANCHA X4 PAQ': 89,
  'AJI-NO-MOTO GMS 500 GR/SACO X30 UND': 31,
  'AJI-NO-MEN VASO GALLINA 50 GR X12 UND': 18,
  'SIB PIMIENTA ECON X50 SOB 3.6 GR/PAQUETE X24 DISPLAY': 80,
  'SIB COMINO ECON X50 SOB 3.6 GR/PAQUETE X24 DISPLAY': 69,
  'AJI-NO-SILLAO BOTELLA 150 ML X6 UND/CAJA X16 PAQUETES': 29,
  'AJI-NO-MEN VASO POLLO 50 GR X12 UND': 19,
  'DOÑA GUSTA CARNE 7 GR X10 SOBRES/BLS X8 TIRA(S)/CAJA X80 TIRA(S)': 45,
  'SIB COMINO GIG X50 SOB 10 GR/PAQUETE X12 DISPLAY': 70,
  'SILLAO TITO 150 ML X12 UND + 1 SOB SIB PANQUITA 31.2 GR': 97,
  'VINAGRE VALLE VERDE BL BOT 1 LT/PAQUETE X12 UND': 99,
  'VINAGRE DEL FIRME TINTO SACHET 1.1 LT/CAJA X12 UND': 96,
  'SIB PALILLO AMARILLITO ECON X84 SOB 9.5 GR/PAQUETE X12 DISPLAY': 77,
  'AJI-NO-SILLAO BOTELLA 500 ML X6 UND/CAJA X4 PAQUETES': 29,
  'VINAGRE DEL FIRME BLANCO SACHET 1.1 LT/CAJA X12 UND': 91,
  'MAYONESA RICASA CAJA X250 SACHET POR 8 GR': 58,
  'SIB OREGANO MERI ECON X68 SOB 3.5 GR/PAQUETE X12 DISPLAY + 2 VINAGRES TINTO 125 ML': 76,
  'SIB SAZONADOR MERI SIN PCTE GIG X42 SOB 27 GR/PAQUETE X12 DISLPLAY': 75,
  'VINAGRE VENTURO BLANCO BOT 600 ML/CAJA X12 UND': 101,
  'AJI-NO-MIX APANADO X96 GR/BLS X15 UND/CAJA X60 UND': 21,
  'AJI-NO-SILLAO BOTELLA 1 LT/CAJA X12 UND': 29,
  'AJI-NO-MIX CHIFA 12 GR X10 SOBRES/BLS X8 TIRA(S)/CAJA X48 TIRA(S)': 22,
  'KETCHUP RICASA CAJA X250 SACHET POR 8 GR': 55,
  'GLUTAMATO MONOSÓDICO NAKAMITO A GRANEL SACO X25 KILOS': 48,
  'VINAGRE VENTURO TINTO BOT 600 ML/CAJA X12 UND': 103,
  'MAYONESA BASE RICASA CAJA X2 BOLSAS DE 2 KG': 57,
  'AJI-NO-MOTO GMS 250 GR X5 SOBRES/SACO X12 PAQUETES': 20,
  'AJI-NO-MEN CARNE 80 GR X24 SOBRES': 13,
  'CHUÑO SANTIS BLS/PAPELO X25 KILOS': 44,
  'SIB TUCO TALLARIN ECON X84 SOB 8.4 GR/PAQUETE X12 DISPLAY': 92,
  'AJI-NO-MEN GALLINA PICANTE 80 GR X24 SOBRES': 15,
  'KETCHUP RICASA CAJA X2 BOLSAS DE 2 KG': 54,
  'SIB SAZONADOR SIN PCTE X12 SOB GIG 100 GR /PAQUETE X6 DISLPL': 89,
  'MOSTAZA RICASA CAJA X250 SACHET POR 8 GR': 60,
  'AJI-NO-MOTO GMS 9 GR X60 SOBRES (S/ 0.30)/SACO X22 PAQUETES': 19,
  'SILLAO TITO 85 ML X12 UND + 1 SOB SIB PANQUITA 31.2 GR': 97,
  'SIB AJI PANQUITA SIN PCTE ECON X24 SOB 31.2 GR/PAQUETE X12 DISPLAY': 52,
  'DURAZNOS EN ALMÍBAR KANKAY X820 GR/CJ X12 UND': null,
  'SIB OREGANO GIG X50 SOB 7 GR/PAQUETE X12 DISPLAY': 79,
};

async function findOrCreateClient(nombre, transaction) {
  const trimmed = nombre.trim();
  let cliente = await Cliente.findOne({ where: { nombre: trimmed }, transaction });
  if (!cliente) {
    cliente = await Cliente.create({ nombre: trimmed, documento: null, activo: true }, { transaction });
    logger.info(`Created client: ${cliente.id} ${trimmed}`);
  }
  return cliente;
}

async function findOrCreateEmployee(nombre, transaction) {
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
  const email = trimmed.toLowerCase().replace(/\s+/g, '.') + '@import.local';
  const usuario = await Usuario.create({
    email,
    nombres: trimmed,
    apellidos: 'Importado',
    password_hash: await require('bcryptjs').hash('Import1234!', 10),
    rol_id: 2,
    activo: true
  }, { transaction });
  logger.info(`Created user: ${usuario.id} ${trimmed}`);
  return usuario;
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

async function processRow(row, transaction) {
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
  const motivoOperacion = String(observaciones || motivo || 'Importación histórica').trim();
  const idempotencyKey = `KX-${crypto.createHash('sha256').update(JSON.stringify(row)).digest('hex').slice(0, 61)}`;
  const operacionExistente = await Operacion.findOne({
    where: { idempotency_key: idempotencyKey },
    transaction,
  });
  if (operacionExistente) return { repetida: true };

  const cliente = await findOrCreateClient(clienteNombre, transaction);
  const usuario = await findOrCreateEmployee(empleado, transaction);
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
      const result = await processRow(row, transaction);
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