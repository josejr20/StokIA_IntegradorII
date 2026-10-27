/**
 * HU-108 / US-21: reglas transparentes de recomendación.
 * No usa ML: el cliente ML del proyecto aún devuelve null.
 * Esta función es pura (sin consultas ni escrituras en la base de datos).
 * Demanda estimada: ventas netas de los últimos 30 días / 30.
 * Los umbrales de 7 y 30 días son configuraciones iniciales para pruebas,
 * no un modelo predictivo entrenado.
 */
const { diasHastaVencimiento } = require('./loteService');

const PERIODO_VENTAS_DIAS = 30;
const UMBRAL_ALTA_DIAS = 7;
const UMBRAL_MEDIA_DIAS = 30;
const HORIZONTE_REPOSICION_DIAS = 7;

function numeroNoNegativo(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? Math.max(0, numero) : 0;
}

function redondear(numero) {
  return Math.round((numero + Number.EPSILON) * 100) / 100;
}

function evaluarProducto(producto, { hoy = new Date() } = {}) {
  const lotes = Array.isArray(producto.lotes) ? producto.lotes : [];
  const ventasNetas = numeroNoNegativo(producto.ventas_netas_30d);
  const registros = numeroNoNegativo(producto.registros_ventas_30d);
  const demandaDiaria = redondear(ventasNetas / PERIODO_VENTAS_DIAS);
  const existeHistorial = registros > 0;

  let stockVencido = 0;
  let stockDisponible = 0;
  let stockPorVencer7 = 0;
  let fechaMasProxima = null;
  let diasMasProximos = null;
  let stockPorVencer30 = 0;

  for (const lote of lotes) {
    const cantidad = numeroNoNegativo(lote.cantidad_actual);
    if (cantidad <= 0) continue;
    const dias = diasHastaVencimiento(lote.fecha_vencimiento, hoy);
    if (dias !== null && dias < 0) {
      stockVencido += cantidad;
      continue;
    }
    stockDisponible += cantidad;
    if (dias === null) continue;
    if (diasMasProximos === null || dias < diasMasProximos) {
      diasMasProximos = dias;
      fechaMasProxima = lote.fecha_vencimiento;
    }
    if (dias <= UMBRAL_ALTA_DIAS) stockPorVencer7 += cantidad;
    if (dias <= UMBRAL_MEDIA_DIAS) stockPorVencer30 += cantidad;
  }

  stockDisponible = redondear(stockDisponible);
  stockVencido = redondear(stockVencido);
  stockPorVencer7 = redondear(stockPorVencer7);
  stockPorVencer30 = redondear(stockPorVencer30);

  let prioridad = 'baja';
  let accion = 'No requiere acción prioritaria';
  let motivo = 'No se detectó un vencimiento cercano ni falta de stock frente a la demanda registrada.';
  let tipoRiesgo = 'sin_riesgo_alto';

  if (stockVencido > 0) {
    prioridad = 'alta';
    tipoRiesgo = 'vencido';
    accion = 'Retirar y revisar los lotes vencidos';
    motivo = `Hay ${stockVencido} unidades vencidas. No deben promocionarse ni venderse.`;
  } else if (stockPorVencer7 > 0 &&
    (!existeHistorial || demandaDiaria * Math.max(0, diasMasProximos) < stockPorVencer7)) {
    prioridad = 'alta';
    tipoRiesgo = 'vencimiento';
    accion = 'Promocionar o liquidar antes del vencimiento';
    motivo = existeHistorial
      ? `Hay ${stockPorVencer7} unidades con vencimiento en 7 días o menos; al ritmo reciente de venta (${demandaDiaria} unidades por día) podrían quedar sin vender.`
      : `Hay ${stockPorVencer7} unidades con vencimiento en 7 días o menos y no hay ventas registradas en los últimos 30 días. Revisar la demanda antes de decidir una promoción.`;
  } else if (existeHistorial && demandaDiaria > 0 && stockDisponible < demandaDiaria * HORIZONTE_REPOSICION_DIAS) {
    prioridad = 'alta';
    tipoRiesgo = 'stock_bajo';
    accion = 'Evaluar reposición de inventario';
    motivo = `El stock disponible (${stockDisponible}) no cubriría 7 días al promedio de ${demandaDiaria} unidades vendidas por día.`;
  } else if (stockPorVencer30 > 0 &&
    (!existeHistorial || demandaDiaria * Math.max(0, diasMasProximos) < stockPorVencer30)) {
    prioridad = 'media';
    tipoRiesgo = 'vencimiento';
    accion = 'Planificar promoción y vigilar el vencimiento';
    motivo = existeHistorial
      ? `Hay ${stockPorVencer30} unidades que vencen dentro de 30 días y la demanda reciente podría no ser suficiente.`
      : `Hay ${stockPorVencer30} unidades que vencen dentro de 30 días; no hay ventas recientes para estimar su salida.`;
  } else if (!existeHistorial) {
    motivo = 'No hay ventas registradas en los últimos 30 días ni vencimiento próximo que requiera atención inmediata. La demanda no se puede estimar con suficiente información.';
  }

  return {
    producto_id: producto.id,
    codigo: producto.codigo,
    nombre: producto.nombre,
    prioridad,
    tipo_riesgo: tipoRiesgo,
    accion,
    motivo,
    stock_disponible: stockDisponible,
    stock_vencido: stockVencido,
    stock_por_vencer_7_dias: stockPorVencer7,
    fecha_proximo_vencimiento: fechaMasProxima,
    dias_para_vencer: diasMasProximos,
    ventas_netas_30_dias: ventasNetas,
    demanda_diaria_estimada: demandaDiaria,
    demanda_estimada_7_dias: redondear((ventasNetas / PERIODO_VENTAS_DIAS) * HORIZONTE_REPOSICION_DIAS),
    demanda_con_historial: existeHistorial,
    metodo_demanda: 'Promedio de ventas netas de los últimos 30 días; no es una predicción ML.'
  };
}

module.exports = {
  evaluarProducto,
  PERIODO_VENTAS_DIAS,
  UMBRAL_ALTA_DIAS,
  UMBRAL_MEDIA_DIAS
};
