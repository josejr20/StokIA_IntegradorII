const { getIO } = require('../config/socket');

/**
 * Eventos de WebSocket soportados:
 * - 'lote:creado'    : { loteId, productoId }
 * - 'lote:actualizado' : { loteId, productoId }
 * - 'lote:eliminado' : { loteId, productoId }
 * - 'producto:creado' : { productoId }
 * - 'producto:actualizado' : { productoId }
 * - 'producto:desactivado' : { productoId }
 * - 'producto:reactivado' : { productoId }
 * - 'movimiento:creado' : { movimientoId, loteId, productoId }
 * - ' venta:creada' : { ventaId, productoId }
 * - ' venta:importada' : { importacionId }
 * - 'inventario:actualizado' : { productoId }
 */

function emitir(evento, datos) {
  try {
    const io = getIO();
    io.emit(evento, datos);
  } catch (error) {
    console.error(`Error emitiendo ${evento}:`, error.message);
  }
}

/**
 * Notifica a los encargados de inventario conectados.
 * HU-133 / US-26 - TC-06.
 */
function notificarEncargadosInventario(datos) {
  try {
    const io = getIO();

    io.to('encargados_inventario').emit(
      'reabastecimiento:orden_generada',
      datos
    );
  } catch (error) {
    console.error(
      'Error notificando orden de reabastecimiento:',
      error.message
    );
  }
}

module.exports = {
  emitir,
  notificarEncargadosInventario
};