'use strict';

/**
 * US-22 / HU-115: consulta el historial, ejecuta HU-114 y registra alertas
 * consultables desde el sistema existente. No altera ventas ni movimientos.
 *
 * NO envia correos, NO emite notificaciones en tiempo real y NO excluye
 * registros del modelo de prediccion. Eso requiere integracion adicional.
 */
const { detectarAnomalias } = require('./detectorAnomaliasService');

const ORIGEN_INTERNO = 'us22_detector_local';
const DIA_MS = 24 * 60 * 60 * 1000;
const LIMITE_REGISTROS = 20000;

function validarOpciones({ diasHistorial, limiteNuevas, ahora }) {
  if (!Number.isInteger(diasHistorial) || diasHistorial < 30 || diasHistorial > 365) {
    throw new RangeError('diasHistorial debe estar entre 30 y 365');
  }
  if (!Number.isInteger(limiteNuevas) || limiteNuevas < 1 || limiteNuevas > 200) {
    throw new RangeError('limiteNuevas debe estar entre 1 y 200');
  }
  if (!(ahora instanceof Date) || !Number.isFinite(ahora.getTime())) {
    throw new TypeError('ahora debe ser una fecha valida');
  }
}

function depsPorDefecto() {
  // Carga tardia: ejecutar las pruebas no requiere una base de datos.
  const { Venta, MovimientoInventario, Lote, Alerta } = require('../models');
  const { Op } = require('sequelize');
  return { Venta, MovimientoInventario, Lote, Alerta, Op };
}

async function obtenerDatos({ diasHistorial, ahora }, { Venta, MovimientoInventario, Lote, Op }) {
  const desde = new Date(ahora.getTime() - diasHistorial * DIA_MS);
  const [ventas, movimientos] = await Promise.all([
    Venta.findAll({
      where: {
        origen: { [Op.in]: ['manual', 'importado'] },
        fecha_venta: { [Op.gte]: desde, [Op.lte]: ahora },
      },
      attributes: ['id', 'producto_id', 'lote_id', 'cantidad', 'origen', 'fecha_venta'],
      order: [['fecha_venta', 'DESC'], ['id', 'DESC']],
      limit: LIMITE_REGISTROS + 1,
      raw: true,
    }),
    MovimientoInventario.findAll({
      where: { fecha: { [Op.gte]: desde, [Op.lte]: ahora } },
      attributes: ['id', 'lote_id', 'tipo', 'origen', 'cantidad', 'fecha'],
      order: [['fecha', 'DESC'], ['id', 'DESC']],
      limit: LIMITE_REGISTROS + 1,
      raw: true,
    }),
  ]);

  // No analizar muestras recortadas: pueden producir alertas estadisticamente falsas.
  if (ventas.length > LIMITE_REGISTROS || movimientos.length > LIMITE_REGISTROS) {
    const error = new Error('Se supero el limite seguro de 20000 registros por tabla. Ajuste el rango de diasHistorial.');
    error.codigo = 'HISTORIAL_DEMASIADO_GRANDE';
    throw error;
  }

  const idsLotes = [...new Set(movimientos.map((mov) => mov.lote_id)
    .filter((id) => id !== null && id !== undefined).map(String))];
  const lotes = idsLotes.length > 0
    ? await Lote.findAll({
      where: { id: { [Op.in]: idsLotes } },
      attributes: ['id', 'producto_id'],
      raw: true,
    })
    : [];

  return { ventas, movimientos, lotes, desde };
}

function construirAlerta(anomalia, lotePorMovimiento = new Map()) {
  const esVenta = anomalia.fuente === 'venta';
  const cantidad = Number(anomalia.cantidad);
  const limiteInferior = Number(anomalia.limite_inferior);
  const limiteSuperior = Number(anomalia.limite_superior);
  const severidad = cantidad > 3 * Math.max(1, limiteSuperior) ? 'alta' : 'media';
  const fuente = esVenta ? 'venta' : 'movimiento';
  const idRegistro = String(anomalia.registro_id);
  const loteId = esVenta ? null : lotePorMovimiento.get(idRegistro) ?? null;

  return {
    tipo: 'anomalia',
    producto_id: Number(anomalia.producto_id),
    lote_id: loteId === null ? null : Number(loteId),
    mensaje: `US-22: ${esVenta ? 'Venta' : 'Movimiento de inventario'} #${idRegistro} del producto #${anomalia.producto_id} con cantidad inusual (${cantidad}). Rango de referencia: ${limiteInferior.toFixed(2)} a ${limiteSuperior.toFixed(2)}. Revisar antes de usar en predicciones.`,
    severidad,
    estado: 'nueva',
    datos_origen: {
      origen: ORIGEN_INTERNO,
      fuente,
      registro_id: idRegistro,
      fecha_registro: anomalia.fecha,
      cantidad: cantidad,
      referencia_mediana: Number(anomalia.referencia_mediana),
      limite_inferior: limiteInferior,
      limite_superior: limiteSuperior,
    },
  };
}

/**
 * guardar=false: solamente vista previa (sin escrituras).
 * guardar=true: crea alertas nuevas de forma idempotente en ejecuciones
 * secuenciales. Para concurrencia entre servidores se requiere un indice unico
 * adicional en PostgreSQL antes de activar una tarea automatica.
 */
async function evaluarAnomalias({
  guardar = false,
  diasHistorial = 180,
  limiteNuevas = 50,
  ahora = new Date(),
} = {}, dependencias) {
  validarOpciones({ diasHistorial, limiteNuevas, ahora });
  if (typeof guardar !== 'boolean') throw new TypeError('guardar debe ser booleano');
  const deps = dependencias ?? depsPorDefecto();
  const { ventas, movimientos, lotes, desde } = await obtenerDatos({ diasHistorial, ahora }, deps);
  const deteccion = detectarAnomalias({ ventas, movimientos, lotes });
  const muestra = deteccion.anomalias.slice(0, 30);
  const resultado = {
    modo: guardar ? 'registro' : 'vista_previa',
    rango_desde: desde.toISOString(),
    rango_hasta: ahora.toISOString(),
    ventas_consultadas: ventas.length,
    movimientos_consultados: movimientos.length,
    resumen_detector: deteccion.resumen,
    anomalias_encontradas: deteccion.anomalias.length,
    muestra_anomalias: muestra,
    muestra_truncada: deteccion.anomalias.length > muestra.length,
    alertas_creadas: 0,
    alertas_ya_existentes: 0,
    pendientes_por_limite: 0,
  };
  if (!guardar) return resultado;

  const lotePorMovimiento = new Map(movimientos.map((mov) => [String(mov.id), mov.lote_id]));
  for (let i = 0; i < deteccion.anomalias.length; i++) {
    const anomalia = deteccion.anomalias[i];
    const alerta = construirAlerta(anomalia, lotePorMovimiento);
    const yaExiste = await deps.Alerta.findOne({
      where: {
        tipo: 'anomalia',
        producto_id: alerta.producto_id,
        datos_origen: { [deps.Op.contains]: {
          origen: ORIGEN_INTERNO,
          fuente: alerta.datos_origen.fuente,
          registro_id: alerta.datos_origen.registro_id,
        } },
      },
    });
    if (yaExiste) {
      resultado.alertas_ya_existentes += 1;
      continue;
    }
    if (resultado.alertas_creadas >= limiteNuevas) {
      resultado.pendientes_por_limite += 1;
      continue;
    }
    await deps.Alerta.create(alerta);
    resultado.alertas_creadas += 1;
  }
  return resultado;
}

module.exports = { evaluarAnomalias, construirAlerta, ORIGEN_INTERNO };
