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
 * - 'operacion:creada' : { operacionId, numero, tipo, total, fecha }
 * - 'operacion:anulada' : { operacionId, numero, tipo }
 * - 'operacion:actualizada' : { operacionId, numero, tipo, estado }
 */

function emitir(evento, datos) {
  try {
    const io = getIO();
    io.emit(evento, datos);
  } catch (error) {
    console.error(`Error emitiendo ${evento}:`, error.message);
  }
}

<<<<<<< HEAD
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
=======
/** Emite un evento de operación y refresca las queries relacionadas. */
function emitirOperacion(evento, operacion) {
  if (!operacion) return;
  emitir(evento, {
    operacionId: operacion.id,
    numero: operacion.numero,
    tipo: operacion.tipo,
    estado: operacion.estado,
    total: Number(operacion.total ?? 0),
    fecha: operacion.fecha,
  });
}

module.exports = { emitir, emitirOperacion };
>>>>>>> 4d80470 (Websocket-Comrobante)
