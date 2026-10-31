'use strict';

/**
 * HU-78 — Ciclo de vida del modelo de demanda: entrenar, evaluar, versionar y avisar.
 *
 * - Cada entrenamiento genera una versión (v1, v2, ...) con su fecha, parámetros y métricas (TC-01, TC-06).
 * - Si el RMSE relativo cumple el umbral, la versión queda activa y la predicción de demanda (HU-72) usa
 *   sus parámetros. Si no, queda guardada como "requiere revisión" y se avisa al administrador (TC-02).
 * - El desempeño del modelo activo se puede volver a medir con las ventas recientes (TC-07).
 */

const demanda = require('./prediccionDemandaModelo');
const entrenamiento = require('./mlEntrenamientoModelo');
const repositorioPorDefecto = require('./mlModeloRepositorio');

const { CONFIG_ML } = entrenamiento;

class ErrorML extends Error {
  constructor(mensaje, codigo, estadoHttp = 422) {
    super(mensaje);
    this.codigo = codigo;
    this.estadoHttp = estadoHttp;
  }
}

let entrenando = false; // solo un entrenamiento a la vez

const porcentaje = (valor) => `${(valor * 100).toLocaleString('es-PE', { maximumFractionDigits: 1 })} %`;
const fechaCorta = (valor) => new Date(valor).toLocaleDateString('es-PE', { timeZone: 'America/Lima' });
const aIso = (valor) => (valor ? new Date(valor).toISOString() : null);

/** Cómo se muestra una versión: activa, requiere revisión (solo la última no activada) o archivada. */
function estadoVisible(modelo, esUltima) {
  if (modelo.estado === 'activo') return 'activo';
  if (esUltima && modelo.metricas.estado_revision === 'requiere_revision') return 'requiere_revision';
  return 'archivado';
}

function resumenVersion(modelo, esUltima = true) {
  const m = modelo.metricas ?? {};
  return {
    id: modelo.id,
    version: modelo.version,
    nombre: modelo.nombre,
    estado: estadoVisible(modelo, esUltima),
    fecha_entrenamiento: aIso(modelo.fecha_entrenamiento),
    parametros: m.parametros ?? null,
    mae: m.mae ?? null,
    rmse: m.rmse ?? null,
    demanda_promedio: m.demanda_promedio ?? null,
    rmse_relativo: m.rmse_relativo ?? null,
    evaluaciones: m.evaluaciones ?? null,
    productos_evaluados: m.productos_evaluados ?? null,
    umbral_rmse_relativo: m.umbral_rmse_relativo ?? CONFIG_ML.UMBRAL_RMSE_RELATIVO,
    validacion: m.validacion ?? null,
    referencia: m.referencia ?? null,
    datos: m.datos ?? null,
    ultima_evaluacion: m.ultima_evaluacion ?? null,
  };
}

// ---------------------------------------------------------------- avisos al administrador

function avisoRevision(modelo) {
  const m = modelo.metricas;
  return {
    codigo: 'requiere_revision',
    severidad: 'alta',
    modelo_id: modelo.id,
    mensaje:
      `El modelo ${modelo.version} no alcanzó el desempeño mínimo: su RMSE relativo es ${porcentaje(m.rmse_relativo ?? 0)} ` +
      `y el umbral aceptable es ${porcentaje(m.umbral_rmse_relativo ?? CONFIG_ML.UMBRAL_RMSE_RELATIVO)}. ` +
      'Requiere revisión antes de ponerse en uso; mientras tanto no se usa para predecir.',
  };
}

function avisoDesempeno(modelo, evaluacion) {
  return {
    codigo: 'desempeno_bajo',
    severidad: 'critica',
    modelo_id: modelo?.id ?? null,
    mensaje:
      `El desempeño del modelo ${modelo ? modelo.version : 'por defecto'} cayó por debajo del umbral aceptable: ` +
      `RMSE relativo ${porcentaje(evaluacion.rmse_relativo ?? 0)} frente a ${porcentaje(evaluacion.umbral_rmse_relativo)} ` +
      `en la evaluación del ${fechaCorta(evaluacion.fecha)}. Conviene reentrenarlo.`,
  };
}

function construirAvisos(versiones) {
  const avisos = [];
  const activo = versiones.find((modelo) => modelo.estado === 'activo');
  if (!activo) {
    avisos.push({
      codigo: 'sin_modelo_activo',
      severidad: 'info',
      modelo_id: null,
      mensaje: 'Todavía no hay un modelo entrenado: las predicciones usan los parámetros por defecto. Entrena el modelo para ajustarlos al historial de ventas.',
    });
  }
  const ultima = versiones[0];
  if (ultima && ultima.estado !== 'activo' && ultima.metricas.estado_revision === 'requiere_revision') {
    avisos.push(avisoRevision(ultima));
  }
  const evaluacion = activo?.metricas.ultima_evaluacion;
  if (evaluacion && evaluacion.aprobado === false) avisos.push(avisoDesempeno(activo, evaluacion));
  return avisos;
}

// ---------------------------------------------------------------- consultas

/** Estado del modelo para la pantalla: versión activa, historial de versiones y avisos. */
async function listar({ repositorio = repositorioPorDefecto } = {}) {
  const versiones = await repositorio.listarModelos(repositorioPorDefecto.TIPO_DEMANDA);
  const activo = versiones.find((modelo) => modelo.estado === 'activo') ?? null;
  const entrenamientos = await repositorio.listarEntrenamientos(1);
  return {
    umbral_rmse_relativo: CONFIG_ML.UMBRAL_RMSE_RELATIVO,
    parametros_por_defecto: demanda.PARAMETROS_POR_DEFECTO,
    modelo_activo: activo ? resumenVersion(activo) : null,
    versiones: versiones.map((modelo, indice) => resumenVersion(modelo, indice === 0)),
    ultimo_entrenamiento: entrenamientos[0]
      ? {
          ...entrenamientos[0],
          iniciado_en: aIso(entrenamientos[0].iniciado_en),
          finalizado_en: aIso(entrenamientos[0].finalizado_en),
        }
      : null,
    avisos: construirAvisos(versiones),
  };
}

// ---------------------------------------------------------------- entrenar (ML-01, ML-02, ML-03)

function armarMetricas(resultado, ahora) {
  return {
    parametros: resultado.parametros,
    mae: resultado.metricas.mae,
    rmse: resultado.metricas.rmse,
    demanda_promedio: resultado.metricas.demanda_promedio,
    rmse_relativo: resultado.metricas.rmse_relativo,
    evaluaciones: resultado.metricas.evaluaciones,
    productos_evaluados: resultado.productos_evaluados,
    umbral_rmse_relativo: resultado.umbral_rmse_relativo,
    aprobado: resultado.aprobado,
    estado_revision: resultado.aprobado ? 'aprobado' : 'requiere_revision',
    validacion: resultado.validacion,
    pruebas: resultado.pruebas,
    candidatos_probados: resultado.candidatos_probados,
    referencia: resultado.referencia,
    datos: resultado.datos,
    horizonte_evaluacion_dias: CONFIG_ML.HORIZONTE_EVALUACION,
    entrenado_en: ahora.toISOString(),
  };
}

function mensajeEntrenamiento(modelo, resultado) {
  const m = resultado.metricas;
  const detalle =
    `RMSE relativo ${porcentaje(m.rmse_relativo ?? 0)} (umbral ${porcentaje(resultado.umbral_rmse_relativo)}), ` +
    `MAE ${m.mae} y RMSE ${m.rmse} unidades por semana, sobre ${m.evaluaciones} pruebas de ${resultado.productos_evaluados} productos.`;
  const nota = resultado.validacion === 'mismos_datos'
    ? ' Hay poco historial para separar datos de medición: las métricas pueden ser optimistas.'
    : '';
  return resultado.aprobado
    ? `Modelo ${modelo.version} entrenado y activado. ${detalle}${nota}`
    : `Modelo ${modelo.version} entrenado, pero requiere revisión antes de ponerse en uso. ${detalle}${nota}`;
}

/**
 * Entrena (o reentrena) con TODO el historial de ventas disponible y registra una nueva versión.
 * Reentrenar con datos nuevos es volver a ejecutarlo: siempre toma las ventas más recientes (TC-05).
 */
async function entrenarModelo({ ahora = new Date(), repositorio = repositorioPorDefecto, config = CONFIG_ML } = {}) {
  if (entrenando) throw new ErrorML('Ya hay un entrenamiento en curso. Espera a que termine.', 'entrenamiento_en_curso', 409);
  entrenando = true;
  let entrenamientoId = null;
  try {
    entrenamientoId = await repositorio.iniciarEntrenamiento();
    const hasta = demanda.ultimoDiaCompleto(ahora);
    const rango = demanda.rangoConsultaUtc(hasta, config.VENTANA_ENTRENAMIENTO_DIAS);
    const ventas = await repositorio.ventas(rango.desde, rango.hasta);

    const resultado = entrenamiento.entrenar(ventas, { hasta, config });
    if (!resultado.ok) {
      await repositorio.finalizarEntrenamiento(entrenamientoId, {
        estado: 'fallido',
        metricas: { datos: resultado.datos, evaluaciones: resultado.evaluaciones },
        detalle: resultado.mensaje,
      });
      throw new ErrorML(resultado.mensaje, resultado.motivo, 422);
    }

    const metricas = armarMetricas(resultado, ahora);
    const registrado = await repositorio.registrarModelo({
      nombre: demanda.NOMBRE_MODELO,
      tipo: repositorioPorDefecto.TIPO_DEMANDA,
      metricas,
      activar: resultado.aprobado,
    });
    const mensaje = mensajeEntrenamiento(registrado, resultado);
    await repositorio.finalizarEntrenamiento(entrenamientoId, {
      estado: 'completado',
      modeloId: registrado.id,
      metricas,
      detalle: mensaje,
    });

    return {
      modelo: resumenVersion(registrado),
      activado: resultado.aprobado,
      mensaje,
      aviso: resultado.aprobado ? null : avisoRevision(registrado),
    };
  } catch (error) {
    if (!(error instanceof ErrorML) && entrenamientoId !== null) {
      try {
        await repositorio.finalizarEntrenamiento(entrenamientoId, { estado: 'fallido', detalle: error.message });
      } catch {
        // no se pudo registrar el fallo; se informa el error original
      }
    }
    throw error;
  } finally {
    entrenando = false;
  }
}

// ---------------------------------------------------------------- activar versión / evaluar desempeño

/** Pone una versión guardada como modelo activo (por ejemplo, tras revisar una que requería revisión). */
async function activarVersion(id, { ahora = new Date(), repositorio = repositorioPorDefecto } = {}) {
  const modelo = await repositorio.obtenerModelo(id);
  if (!modelo || modelo.tipo !== repositorioPorDefecto.TIPO_DEMANDA) {
    throw new ErrorML('La versión del modelo no existe.', 'modelo_no_encontrado', 404);
  }
  const activado = await repositorio.activarModelo(id, {
    estado_revision: 'activado_manualmente',
    activado_en: ahora.toISOString(),
  });
  return { modelo: resumenVersion(activado), mensaje: `El modelo ${activado.version} quedó activo.` };
}

/**
 * TC-07: vuelve a medir el modelo activo (o los parámetros por defecto si no hay) con las ventas de los
 * últimos días. Si el RMSE relativo supera el umbral, devuelve un aviso y lo deja guardado en el modelo.
 */
async function evaluarModeloActivo({ ahora = new Date(), repositorio = repositorioPorDefecto, config = CONFIG_ML } = {}) {
  const activo = await repositorio.obtenerModeloActivo(repositorioPorDefecto.TIPO_DEMANDA);
  const parametros = demanda.normalizarParametros(activo?.parametros);

  const hasta = demanda.ultimoDiaCompleto(ahora);
  const rango = demanda.rangoConsultaUtc(hasta, config.VENTANA_ENTRENAMIENTO_DIAS);
  const ventas = await repositorio.ventas(rango.desde, rango.hasta);

  const resultado = entrenamiento.evaluarParametros(ventas, parametros, { hasta, config });
  if (!resultado.ok) throw new ErrorML(resultado.mensaje, resultado.motivo, 422);

  const evaluacion = {
    fecha: ahora.toISOString(),
    mae: resultado.metricas.mae,
    rmse: resultado.metricas.rmse,
    rmse_relativo: resultado.metricas.rmse_relativo,
    evaluaciones: resultado.metricas.evaluaciones,
    productos_evaluados: resultado.productos_evaluados,
    dias_evaluados: resultado.dias_evaluados,
    umbral_rmse_relativo: resultado.umbral_rmse_relativo,
    aprobado: resultado.aprobado,
  };
  if (activo) await repositorio.actualizarMetricas(activo.id, { ultima_evaluacion: evaluacion });

  const aviso = resultado.aprobado ? null : avisoDesempeno(activo, evaluacion);
  return {
    modelo: activo ? resumenVersion(activo) : null,
    evaluacion,
    aviso,
    mensaje: resultado.aprobado
      ? `El desempeño es aceptable: RMSE relativo ${porcentaje(evaluacion.rmse_relativo ?? 0)} (umbral ${porcentaje(evaluacion.umbral_rmse_relativo)}).`
      : aviso.mensaje,
  };
}

module.exports = { ErrorML, listar, entrenarModelo, activarVersion, evaluarModeloActivo };
