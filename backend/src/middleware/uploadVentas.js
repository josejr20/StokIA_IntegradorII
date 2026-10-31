const path = require('path');
const multer = require('multer');

const extensionesPermitidas = new Set(['.csv', '.xlsx', '.xls']);

const uploadVentas = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!extensionesPermitidas.has(extension)) {
      return callback(new Error('El archivo debe ser CSV o Excel (.csv, .xlsx, .xls)'));
    }
    callback(null, true);
  },
});

function recibirArchivoVenta(req, res, next) {
  uploadVentas.single('archivo')(req, res, (error) => {
    if (!error) return next();
    const mensaje = error.code === 'LIMIT_FILE_SIZE'
      ? 'El archivo no puede superar los 10 MB'
      : error.message;
    return res.status(400).json({ error: mensaje });
  });
}

module.exports = { recibirArchivoVenta };
