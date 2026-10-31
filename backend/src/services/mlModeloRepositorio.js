'use strict';

/**
 * HU-78 — Acceso a las tablas del esquema `ml` (ml.modelos y ml.entrenamientos).
 *
 * Esas tablas no tienen columna de parámetros y `ml.modelos.estado` solo admite 'activo' o 'archivado',
 * así que los parámetros, las métricas y el estado de revisión se guardan dentro del campo JSON `metricas`.
 * Las fechas de esas tablas son "timestamp sin zona" guardadas en UTC: se leen con AT TIME ZONE 'UTC'.
 */

const TIPO_DEMANDA = 'demanda';

function acceso() {
  const { sequelize } = require('../models');
  const { QueryTypes } = require('sequelize');
  return { sequelize, QueryTypes };
}

async function consultar(sql, replacements = {}, transaction) {
  const { sequelize, QueryTypes } = acceso();
  return sequelize.query(sql, { replacements, type: QueryTypes.SELECT, transaction });
}

async function ejecutar(sql, replacements = {}, transaction) {
  const { sequelize } = acceso();
  await sequelize.query(sql, { replacements, transaction });
}

const COLUMNAS_MODELO = `id, nombre, tipo, version, estado, metricas,
  (fecha_entrenamiento AT TIME ZONE 'UTC') AS fecha_entrenamiento`;

function aModelo(fila) {
  if (!fila) return null;
  return {
    id: Number(fila.id),
    nombre: fila.nombre,
    tipo: fila.tipo,
    version: fila.version,
    estado: fila.estado,
    fecha_entrenamiento: fila.fecha_entrenamiento,
    metricas: fila.metricas ?? {},
  };
}

/** Modelo activo (o null). Lo usa la predicción de demanda para tomar sus parámetros. */
async function obtenerModeloActivo(tipo = TIPO_DEMANDA) {
  const filas = await consultar(
    `SELECT ${COLUMNAS_MODELO} FROM ml.modelos
      WHERE tipo = :tipo AND estado = 'activo'
      ORDER BY fecha_entrenamiento DESC, id DESC LIMIT 1`,
    { tipo },
  );
  const modelo = aModelo(filas[0]);
  return modelo ? { ...modelo, parametros: modelo.metricas.parametros ?? null } : null;
}

async function obtenerModelo(id) {
  const filas = await consultar(`SELECT ${COLUMNAS_MODELO} FROM ml.modelos WHERE id = :id`, { id });
  return aModelo(filas[0]);
}

async function listarModelos(tipo = TIPO_DEMANDA, limite = 50) {
  const filas = await consultar(
    `SELECT ${COLUMNAS_MODELO} FROM ml.modelos
      WHERE tipo = :tipo ORDER BY fecha_entrenamiento DESC, id DESC LIMIT :limite`,
    { tipo, limite },
  );
  return filas.map(aModelo);
}

async function listarEntrenamientos(limite = 10) {
  const filas = await consultar(
    `SELECT id, modelo_id, estado, detalle,
            (iniciado_en AT TIME ZONE 'UTC') AS iniciado_en,
            (finalizado_en AT TIME ZONE 'UTC') AS finalizado_en
       FROM ml.entrenamientos ORDER BY id DESC LIMIT :limite`,
    { limite },
  );
  return filas.map((fila) => ({ ...fila, id: Number(fila.id), modelo_id: fila.modelo_id === null ? null : Number(fila.modelo_id) }));
}

async function iniciarEntrenamiento() {
  const filas = await consultar(`INSERT INTO ml.entrenamientos (estado) VALUES ('en_progreso') RETURNING id`);
  return Number(filas[0].id);
}

async function finalizarEntrenamiento(id, { estado, modeloId = null, metricas = null, detalle = null }) {
  await ejecutar(
    `UPDATE ml.entrenamientos
        SET finalizado_en = now(), estado = :estado, modelo_id = :modeloId,
            metricas = CAST(:metricas AS jsonb), detalle = :detalle
      WHERE id = :id`,
    { id, estado, modeloId, metricas: metricas === null ? null : JSON.stringify(metricas), detalle },
  );
}

/**
 * Registra una versión nueva. Si `activar` es true queda como modelo activo y los demás pasan a
 * 'archivado'; si no, entra como 'archivado' (el activo actual no cambia). Todo en una transacción.
 */
async function registrarModelo({ nombre, tipo = TIPO_DEMANDA, metricas, activar }) {
  const { sequelize } = acceso();
  return sequelize.transaction(async (transaction) => {
    const siguiente = await consultar(
      `SELECT COALESCE(MAX(NULLIF(regexp_replace(version, '[^0-9]', '', 'g'), '')::int), 0) + 1 AS numero
         FROM ml.modelos WHERE tipo = :tipo`,
      { tipo },
      transaction,
    );
    const version = `v${siguiente[0].numero}`;
    if (activar) {
      await ejecutar(`UPDATE ml.modelos SET estado = 'archivado' WHERE tipo = :tipo AND estado = 'activo'`, { tipo }, transaction);
    }
    const filas = await consultar(
      `INSERT INTO ml.modelos (nombre, tipo, version, metricas, estado)
       VALUES (:nombre, :tipo, :version, CAST(:metricas AS jsonb), :estado)
       RETURNING ${COLUMNAS_MODELO}`,
      { nombre, tipo, version, metricas: JSON.stringify(metricas), estado: activar ? 'activo' : 'archivado' },
      transaction,
    );
    return aModelo(filas[0]);
  });
}

/** Pone una versión como activa (y archiva las demás). `parche` se mezcla en su campo metricas. */
async function activarModelo(id, parche = {}) {
  const { sequelize } = acceso();
  await sequelize.transaction(async (transaction) => {
    await ejecutar(
      `UPDATE ml.modelos SET estado = 'archivado'
        WHERE estado = 'activo' AND tipo = (SELECT tipo FROM ml.modelos WHERE id = :id)`,
      { id },
      transaction,
    );
    await ejecutar(
      `UPDATE ml.modelos
          SET estado = 'activo', metricas = COALESCE(metricas, '{}'::jsonb) || CAST(:parche AS jsonb)
        WHERE id = :id`,
      { id, parche: JSON.stringify(parche) },
      transaction,
    );
  });
  return obtenerModelo(id);
}

/** Mezcla `parche` en el campo metricas de una versión (por ejemplo, la última evaluación). */
async function actualizarMetricas(id, parche) {
  await ejecutar(
    `UPDATE ml.modelos SET metricas = COALESCE(metricas, '{}'::jsonb) || CAST(:parche AS jsonb) WHERE id = :id`,
    { id, parche: JSON.stringify(parche) },
  );
}

const ORIGENES_VENTA = ['manual', 'importado'];

/** Ventas netas (manual + importado) del rango [desde, hastaExclusivo) de TODOS los productos. */
async function ventas(desde, hastaExclusivo) {
  const { Venta } = require('../models');
  const { Op } = require('sequelize');
  return Venta.findAll({
    where: {
      origen: { [Op.in]: ORIGENES_VENTA },
      fecha_venta: { [Op.gte]: desde, [Op.lt]: hastaExclusivo },
    },
    attributes: ['producto_id', 'cantidad', 'fecha_venta'],
    raw: true,
  });
}

module.exports = {
  TIPO_DEMANDA,
  obtenerModeloActivo,
  obtenerModelo,
  listarModelos,
  listarEntrenamientos,
  iniciarEntrenamiento,
  finalizarEntrenamiento,
  registrarModelo,
  activarModelo,
  actualizarMetricas,
  ventas,
};
