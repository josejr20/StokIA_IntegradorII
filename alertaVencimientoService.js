'use strict';

/**
 * US-29 · Alertas de riesgo de vencimiento para el dashboard.
 *
 * Responsabilidades:
 *  - Listar las alertas ACTIVAS de riesgo ALTO con producto, lote y motivo (HU-148).
 *  - Marcar una alerta como atendida dejando rastro de quién y cuándo (HU-149).
 *  - Recalcular el riesgo contra los datos actuales y avisar por WebSocket a todos
 *    los clientes conectados cuando algo cambió (HU-150).
 *
 * Todas las dependencias (modelos, motor de riesgo, WebSocket, logger) son
 * inyectables para poder probar el servicio sin base de datos ni red.
 */

const SEVERIDADES_ALTAS = ['alta', 'critica'];
const ESTADOS_ACTIVOS = ['nueva', 'vista'];
const EVENTO_ALERTAS_ACTUALIZADAS = 'alertas:vencimiento_actualizadas';

/** Error de negocio con código HTTP, para que el controlador responda sin adivinar. */
class AlertaError extends Error {
  constructor(mensaje, status = 400) {
    super(mensaje);
    this.name = 'AlertaError';
    this.status = status;
  }
}

/**
 * Resuelve las dependencias reales solo cuando se usan (getters perezosos):
 * listar alertas no necesita cargar WebSocket ni el motor de riesgo, y las
 * pruebas inyectan lo que necesitan sin tocar base de datos ni red.
 */
function resolverDependencias(deps = {}) {
  const perezoso = (nombre, cargar) => ({
    get: () => (deps[nombre] !== undefined ? deps[nombre] : cargar()),
    enumerable: true,
  });
  return Object.defineProperties({}, {
    Alerta: perezoso('Alerta', () => require('../models').Alerta),
    Op: perezoso('Op', () => require('sequelize').Op),
    analizarRiesgo: perezoso('analizarRiesgo', () => require('./riesgoVencimientoService').analizarRiesgo),
    sincronizar: perezoso('sincronizar', () => require('./notificacionAlertaService').sincronizarAlertasRiesgo),
    emitir: perezoso('emitir', () => require('./wsService').emitir),
    logger: perezoso('logger', () => require('../utils/logger')),
    ahora: perezoso('ahora', () => () => new Date()),
  });
}

/** Convierte una alerta de BD en lo que necesita la tarjeta del dashboard (TC-04). */
function aDtoVencimiento(alerta) {
  const json = typeof alerta.toJSON === 'function' ? alerta.toJSON() : alerta;
  const datos = json.datos_origen ?? {};
  return {
    id: Number(json.id),
    severidad: json.severidad,
    estado: json.estado,
    producto: {
      id: json.producto_id,
      codigo: datos.codigo ?? null,
      nombre: datos.nombre ?? null,
    },
    lote: {
      id: json.lote_id,
      numero: datos.numero_lote ?? null,
    },
    // Motivo: el texto que explica por qué el lote está en riesgo.
    motivo: datos.mensaje || json.mensaje,
    factores: Array.isArray(datos.factores) ? datos.factores : [],
    fecha_vencimiento: datos.fecha_vencimiento ?? null,
    dias_para_vencer: datos.dias_para_vencer ?? null,
    stock: datos.stock ?? null,
    unidades_en_riesgo: datos.unidades_en_riesgo ?? null,
    porcentaje_en_riesgo: datos.porcentaje_en_riesgo ?? null,
    fecha_creacion: json.fecha_creacion,
  };
}

/** Los lotes que vencen antes van primero; sin fecha, al final. */
function compararUrgencia(a, b) {
  const da = a.dias_para_vencer ?? Number.POSITIVE_INFINITY;
  const db = b.dias_para_vencer ?? Number.POSITIVE_INFINITY;
  if (da !== db) return da - db;
  return new Date(b.fecha_creacion) - new Date(a.fecha_creacion);
}

async function consultarActivas({ Alerta, Op }) {
  return Alerta.findAll({
    where: {
      tipo: 'riesgo_vencimiento',
      severidad: { [Op.in]: SEVERIDADES_ALTAS },
      estado: { [Op.in]: ESTADOS_ACTIVOS },
    },
    order: [['fecha_creacion', 'DESC']],
  });
}

/** Huella del conjunto de alertas activas: sirve para saber si hubo cambios que avisar. */
function firma(alertas) {
  return alertas.map((a) => `${a.id}:${a.severidad}:${a.estado}`).sort().join('|');
}

/** TC-01 / TC-03 / TC-04: alertas de riesgo alto activas, sin recalcular. */
async function listarActivas(deps = {}) {
  const d = resolverDependencias(deps);
  const alertas = await consultarActivas(d);
  return alertas.map(aDtoVencimiento).sort(compararUrgencia);
}

let refrescoEnCurso = null;

async function ejecutarRefresco({ usuarioId, productoIds }, deps) {
  const d = resolverDependencias(deps);
  const antes = firma(await consultarActivas(d));

  // Si el motor falla seguimos mostrando lo último guardado en vez de romper el dashboard.
  let sincronizado = true;
  try {
    const analisis = await d.analizarRiesgo({ productoIds });
    await d.sincronizar(analisis.productos, { alcanceProductoIds: productoIds, usuarioId });
  } catch (error) {
    sincronizado = false;
    d.logger.error(`No se pudo recalcular el riesgo de vencimiento: ${error.message}`);
  }

  const activas = await consultarActivas(d);
  // TC-06: solo se avisa cuando algo cambió (evita bucles de refresco entre clientes).
  if (firma(activas) !== antes) {
    d.emitir(EVENTO_ALERTAS_ACTUALIZADAS, { motivo: 'recalculo' });
  }

  const alertas = activas.map(aDtoVencimiento).sort(compararUrgencia);
  return {
    alertas,
    total: alertas.length,
    hay_alertas: alertas.length > 0, // TC-02 / TC-07
    sincronizado,
    actualizado_en: d.ahora().toISOString(),
  };
}

/**
 * Recalcula el riesgo con stock, ventas y vencimientos actuales y devuelve las alertas.
 * Las llamadas simultáneas comparten el mismo cálculo: varios dashboards abiertos
 * reaccionan al mismo evento y, sin esto, podrían crear alertas duplicadas.
 */
function refrescarYListar({ usuarioId = null, productoIds = null } = {}, deps = {}) {
  if (productoIds) return ejecutarRefresco({ usuarioId, productoIds }, deps);
  if (!refrescoEnCurso) {
    refrescoEnCurso = ejecutarRefresco({ usuarioId, productoIds }, deps)
      .finally(() => { refrescoEnCurso = null; });
  }
  return refrescoEnCurso;
}

/**
 * TC-05: marca una alerta como atendida. Es idempotente (atender dos veces no falla)
 * y guarda atencion='manual' para que el recálculo no vuelva a crearla mientras
 * el riesgo siga igual (ver sincronizarAlertasRiesgo).
 */
async function marcarAtendida(alertaId, { usuarioId = null } = {}, deps = {}) {
  const d = resolverDependencias(deps);
  const alerta = await d.Alerta.findByPk(alertaId);
  if (!alerta) throw new AlertaError('Alerta no encontrada', 404);

  if (alerta.estado === 'atendida') return aDtoVencimiento(alerta);
  if (alerta.estado === 'descartada') {
    throw new AlertaError('La alerta ya fue descartada', 409);
  }

  const ahora = d.ahora();
  await alerta.update({
    estado: 'atendida',
    fecha_atendida: ahora,
    datos_origen: {
      ...(alerta.datos_origen ?? {}),
      atencion: 'manual',
      atendida_por: usuarioId,
      atendida_en: ahora.toISOString(),
    },
  });

  if (alerta.tipo === 'riesgo_vencimiento') {
    d.emitir(EVENTO_ALERTAS_ACTUALIZADAS, { motivo: 'atendida', alertaId: Number(alerta.id) });
  }
  return aDtoVencimiento(alerta);
}

module.exports = {
  AlertaError,
  EVENTO_ALERTAS_ACTUALIZADAS,
  SEVERIDADES_ALTAS,
  aDtoVencimiento,
  listarActivas,
  marcarAtendida,
  refrescarYListar,
};
