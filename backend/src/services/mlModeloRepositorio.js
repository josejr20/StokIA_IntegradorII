'use strict';

/**
 * HU-78 — Acceso a las tablas del esquema `ml` de la base compartida (definidas por el equipo de ML):
 *   ml.modelos            versiones del modelo (version, algoritmo, activo, mae, rmse, metadata, notas, ...)
 *   ml.entrenamientos_log un registro por cada entrenamiento (manual | reentrenamiento; exitoso | insuficiente_datos | sin_mejora)
 *   ml.preparaciones_log  resumen de los datos preparados para entrenar
 *   ml.configuracion      clave/valor (por ejemplo min_filas_entrenamiento)
 *
 * Nuestras filas de ml.modelos se identifican con ALGORITMO: así no tocamos las de otros modelos. Los parámetros
 * del modelo, las métricas relativas y el estado de revisión viajan en la columna JSON `metadata`.
 */

const ALGORITMO = 'holt_amortiguado_estacional';
// ml.modelos.ruta_artefacto es obligatoria, pero este modelo no tiene archivo: sus parámetros están en `metadata`.
const RUTA_ARTEFACTO = 'metadata:parametros';

const COLUMNAS = 'id, version, algoritmo, activo, mae, rmse, filas_entrenamiento, ruta_artefacto, metadata, fecha_creacion, notas';

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

function aModelo(fila) {
  if (!fila) return null;
  return {
    id: Number(fila.id),
    version: Number(fila.version),
    algoritmo: fila.algoritmo,
    activo: fila.activo === true,
    mae: Number(fila.mae),
    rmse: Number(fila.rmse),
    filas_entrenamiento: Number(fila.filas_entrenamiento),
    ruta_artefacto: fila.ruta_artefacto,
    metadata: fila.metadata ?? {},
    fecha_creacion: fila.fecha_creacion,
    notas: fila.notas,
  };
}

/** Modelo activo de este algoritmo (o null). Lo usa la predicción de demanda para tomar sus parámetros. */
async function obtenerModeloActivo() {
  const filas = await consultar(
    `SELECT ${COLUMNAS} FROM ml.modelos WHERE algoritmo = :algoritmo AND activo = true ORDER BY version DESC, id DESC LIMIT 1`,
    { algoritmo: ALGORITMO },
  );
  const modelo = aModelo(filas[0]);
  return modelo ? { ...modelo, parametros: modelo.metadata.parametros ?? null } : null;
}

async function obtenerModelo(id) {
  return aModelo((await consultar(`SELECT ${COLUMNAS} FROM ml.modelos WHERE id = :id`, { id }))[0]);
}

async function listarModelos(limite = 50) {
  const filas = await consultar(
    `SELECT ${COLUMNAS} FROM ml.modelos WHERE algoritmo = :algoritmo ORDER BY version DESC, id DESC LIMIT :limite`,
    { algoritmo: ALGORITMO, limite },
  );
  return filas.map(aModelo);
}

/**
 * Registra una versión nueva (número = el mayor de la tabla + 1, para no repetir el de otros modelos).
 * Si `activar` es true queda activa y las demás de este algoritmo pasan a inactivas. Todo en una transacción.
 */
async function registrarModelo({ metadata, mae, rmse, filas_entrenamiento: filas, notas, activar }) {
  const { sequelize } = acceso();
  return sequelize.transaction(async (transaction) => {
    const siguiente = await consultar('SELECT COALESCE(MAX(version), 0) + 1 AS numero FROM ml.modelos', {}, transaction);
    if (activar) {
      await ejecutar('UPDATE ml.modelos SET activo = false WHERE algoritmo = :algoritmo AND activo = true', { algoritmo: ALGORITMO }, transaction);
    }
    const insertadas = await consultar(
      `INSERT INTO ml.modelos (version, algoritmo, activo, mae, rmse, filas_entrenamiento, ruta_artefacto, metadata, notas)
       VALUES (:version, :algoritmo, :activo, :mae, :rmse, :filas, :ruta, CAST(:metadata AS jsonb), :notas)
       RETURNING ${COLUMNAS}`,
      {
        version: Number(siguiente[0].numero),
        algoritmo: ALGORITMO,
        activo: activar === true,
        mae,
        rmse,
        filas,
        ruta: RUTA_ARTEFACTO,
        metadata: JSON.stringify(metadata),
        notas,
      },
      transaction,
    );
    return aModelo(insertadas[0]);
  });
}

/** Pone una versión como activa (y desactiva las demás de este algoritmo). `parche` se mezcla en su metadata. */
async function activarModelo(id, parche = {}) {
  const { sequelize } = acceso();
  await sequelize.transaction(async (transaction) => {
    await ejecutar('UPDATE ml.modelos SET activo = false WHERE algoritmo = :algoritmo AND activo = true', { algoritmo: ALGORITMO }, transaction);
    await ejecutar(
      `UPDATE ml.modelos SET activo = true, metadata = COALESCE(metadata, '{}'::jsonb) || CAST(:parche AS jsonb)
        WHERE id = :id AND algoritmo = :algoritmo`,
      { id, algoritmo: ALGORITMO, parche: JSON.stringify(parche) },
      transaction,
    );
  });
  return obtenerModelo(id);
}

async function actualizarMetadata(id, parche) {
  await ejecutar(
    `UPDATE ml.modelos SET metadata = COALESCE(metadata, '{}'::jsonb) || CAST(:parche AS jsonb) WHERE id = :id AND algoritmo = :algoritmo`,
    { id, algoritmo: ALGORITMO, parche: JSON.stringify(parche) },
  );
}

async function registrarEntrenamiento({ modeloId = null, disparadoPor, resultado, promovido, mensaje }) {
  await ejecutar(
    `INSERT INTO ml.entrenamientos_log (modelo_id, disparado_por, resultado, promovido, mensaje)
     VALUES (:modeloId, :disparadoPor, :resultado, :promovido, :mensaje)`,
    { modeloId, disparadoPor, resultado, promovido, mensaje },
  );
}

async function listarEntrenamientos(limite = 10) {
  const filas = await consultar(
    'SELECT id, modelo_id, disparado_por, resultado, promovido, mensaje, fecha FROM ml.entrenamientos_log ORDER BY id DESC LIMIT :limite',
    { limite },
  );
  return filas.map((fila) => ({ ...fila, id: Number(fila.id), modelo_id: fila.modelo_id === null ? null : Number(fila.modelo_id) }));
}

async function registrarPreparacion({ total_filas: total, filas_validas: validas, filas_descartadas: descartadas, motivos_descarte: motivos, listo_para_entrenar: listo }) {
  await ejecutar(
    `INSERT INTO ml.preparaciones_log (total_filas, filas_validas, filas_descartadas, motivos_descarte, listo_para_entrenar)
     VALUES (:total, :validas, :descartadas, CAST(:motivos AS jsonb), :listo)`,
    { total, validas, descartadas, motivos: JSON.stringify(motivos), listo },
  );
}

/** Filas válidas mínimas para entrenar, según ml.configuracion (o null si no está definido). */
async function minimoFilasEntrenamiento() {
  const filas = await consultar("SELECT valor FROM ml.configuracion WHERE clave = 'min_filas_entrenamiento'");
  const valor = Number(filas[0]?.valor);
  return Number.isFinite(valor) && valor > 0 ? valor : null;
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
  ALGORITMO,
  RUTA_ARTEFACTO,
  obtenerModeloActivo,
  obtenerModelo,
  listarModelos,
  registrarModelo,
  activarModelo,
  actualizarMetadata,
  registrarEntrenamiento,
  listarEntrenamientos,
  registrarPreparacion,
  minimoFilasEntrenamiento,
  ventas,
};
