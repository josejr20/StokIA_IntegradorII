'use strict';

/**
 * US-22 / HU-116. Filtra SOLO ventas que cuenten con una alerta de anomalia
 * originada en US-22. La operacion no modifica ni elimina registros de la BD.
 *
 * Estados bloqueados: nueva, vista, atendida.
 * Estado descartada: el dato vuelve a incluirse, pues la alerta se rechazo.
 * La revision de alertas se gestiona desde la aplicacion existente.
 */
const ESTADOS_EXCLUIDOS = new Set(['nueva', 'vista', 'atendida']);
const ORIGEN_DETECTOR = 'us22_detector_local';

function claveVenta(productoId, ventaId) {
  if (productoId === null || productoId === undefined ||
      ventaId === null || ventaId === undefined) return null;
  const p = String(productoId).trim();
  const v = String(ventaId).trim();
  if (!p || !v) return null;
  // El arreglo serializado evita colisiones y mantiene precisos los IDs BIGINT.
  return JSON.stringify([p, v]);
}

function esAlertaVentaUS22(alerta) {
  if (!alerta || alerta.tipo !== 'anomalia' || !ESTADOS_EXCLUIDOS.has(alerta.estado)) return false;
  const datos = alerta.datos_origen;
  return datos !== null && typeof datos === 'object' && !Array.isArray(datos) &&
    datos.origen === ORIGEN_DETECTOR && datos.fuente === 'venta';
}

function filtrarVentasPorAlertas(ventas, alertas) {
  if (!Array.isArray(ventas) || !Array.isArray(alertas)) {
    throw new TypeError('ventas y alertas deben ser arreglos');
  }
  const claves = new Set();
  for (const alerta of alertas) {
    if (!esAlertaVentaUS22(alerta)) continue;
    const clave = claveVenta(alerta.producto_id, alerta.datos_origen.registro_id);
    if (clave) claves.add(clave);
  }

  const ventasValidas = [];
  const excluidosPorProducto = new Map();
  const ventasExcluidas = [];
  for (const venta of ventas) {
    const clave = venta && claveVenta(venta.producto_id, venta.id);
    if (clave && claves.has(clave)) {
      const producto = String(venta.producto_id);
      excluidosPorProducto.set(producto, (excluidosPorProducto.get(producto) || 0) + 1);
      ventasExcluidas.push({ producto_id: venta.producto_id, registro_id: String(venta.id) });
    } else {
      ventasValidas.push(venta);
    }
  }
  return { ventasValidas, ventasExcluidas, excluidosPorProducto };
}

module.exports = { filtrarVentasPorAlertas, esAlertaVentaUS22, claveVenta, ESTADOS_EXCLUIDOS };
