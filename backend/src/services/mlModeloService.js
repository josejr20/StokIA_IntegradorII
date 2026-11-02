'use strict';

/**
 * HU-78 — Ciclo de vida del modelo de demanda: entrenar, evaluar, versionar y avisar.
 *
 * - Cada entrenamiento genera una versión en ml.modelos y un registro en ml.entrenamientos_log (TC-01, TC-06).
 * - Se promueve (queda activa y la usa la predicción de HU-72) solo si cumple el umbral de RMSE relativo y no
 *   empeora al modelo activo medido sobre los mismos datos. Si no cumple el umbral, queda "requiere revisión" y
 *   se avisa al administrador (TC-02). Si cumple pero no mejora, queda como "sin_mejora".
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

/** Convierte los errores de base de datos más comunes en mensajes claros (en vez de un error 500). */
function traducirErrorBD(error) {
  if (error instanceof ErrorML) return error;
  const codigo = error?.parent?.code ?? error?.original?.code ?? error?.code;
  if (codigo === '42P01' || codigo === '3F000') {
    return new ErrorML(
      'No se encontraron las tablas del esquema ml (ml.modelos, ml.entrenamientos_log, ml.preparaciones_log y ml.configuracion) ' +
        'en la base de datos conectada. Pide al equipo de ML que las cree antes de usar esta pantalla.',
      'tablas_ml_no_disponibles',
      503,
    );
  }
  if (codigo === '42703') {
    return new ErrorML(
      `La estructura de las tablas del esquema ml no coincide con la esperada por esta pantalla (${error?.parent?.message ?? error.message}).`,
      'estructura_ml_distinta',
      503,
    );
  }
  if (codigo === '23505') {
    return new ErrorML(
      'Ya hay otro modelo activo en ml.modelos (la tabla solo admite uno). Revisa cuál es antes de entrenar o activar.',
      'conflicto_modelo_activo',
      409,
    );
  }
  if (codigo === '42501') {
    return new ErrorML('El usuario de la base de datos no tiene permisos sobre el esquema ml.', 'permisos_ml', 503);
  }
  return error;
}

const conTraduccion = (funcion) => async (...args) => {
  try {
    return await funcion(...args);
  } catch (error) {
    throw traducirErrorBD(error);
  }
};

// Los registros auxiliares (logs) no deben tumbar un entrenamiento que ya se guardó bien.
async function intentar(accion) {
  try {
    await accion();
  } catch {
    // se ignora: la versión del modelo ya quedó registrada en ml.modelos
  }
}

const etiqueta = (numero) => `v${numero}`;
const porcentaje = (valor) => `${((valor ?? 0) * 100).toLocaleString('es-PE', { maximumFractionDigits: 1 })} %`;
const fechaCorta = (valor) => new Date(valor).toLocaleDateString('es-PE', { timeZone: 'America/Lima' });
const aIso = (valor) => (valor ? new Date(valor).toISOString() : null);

/** Cómo se muestra una versión: activa, requiere revisión (solo la última no activada) o archivada. */
function estadoVisible(modelo, esUltima) {
  if (modelo.activo) return 'activo';
  if (esUltima && modelo.metadata?.estado_revision === 'requiere_revision') return 'requiere_revision';
  return 'archivado';
}

function resumenVersion(modelo, esUltima = true) {
  const m = modelo.metadata ?? {};
  return {
    id: modelo.id,
    version: etiqueta(modelo.version),
    nombre: m.nombre ?? modelo.algoritmo,
    estado: estadoVisible(modelo, esUltima),
    fecha_entrenamiento: aIso(modelo.fecha_creacion),
    parametros: m.parametros ?? null,
    mae: modelo.mae ?? null,
    rmse: modelo.rmse ?? null,
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
  const m = modelo.metadata;
  return {
    codigo: 'requiere_revision',
    severidad: 'alta',
    modelo_id: modelo.id,
    mensaje:
      `El modelo ${etiqueta(modelo.version)} no alcanzó el desempeño mínimo: su RMSE relativo es ${porcentaje(m.rmse_relativo)} ` +
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
      `El desempeño del modelo ${modelo ? etiqueta(modelo.version) : 'por defecto'} cayó por debajo del umbral aceptable: ` +
      `RMSE relativo ${porcentaje(evaluacion.rmse_relativo)} frente a ${porcentaje(evaluacion.umbral_rmse_relativo)} ` +
      `en la evaluación del ${fechaCorta(evaluacion.fecha)}. Conviene reentrenarlo.`,
  };
}

function construirAvisos(versiones, otroActivo = null) {
  const avisos = [];
  const activo = versiones.find((modelo) => modelo.activo);
  if (!activo && !otroActivo) {
    avisos.push({
      codigo: 'sin_modelo_activo',
      severidad: 'info',
      modelo_id: null,
      mensaje: versiones.length === 0
        ? 'Todavía no hay un modelo entrenado: las predicciones usan los parámetros por defecto. Entrena el modelo para ajustarlos al historial de ventas.'
        : 'No hay un modelo activo: las predicciones usan los parámetros por defecto. Activa una versión o entrena el modelo.',
    });
  }
  if (otroActivo) {
    avisos.push({
      codigo: 'otro_modelo_activo',
      severidad: 'info',
      modelo_id: otroActivo.id,
      mensaje:
        `En ml.modelos el modelo activo es de otro algoritmo (${otroActivo.algoritmo}, ${etiqueta(otroActivo.version)}) y la tabla solo admite uno. ` +
        'Mientras siga así, el modelo de demanda no se usa para predecir (se usan los parámetros por defecto). ' +
        'Activar una versión de aquí lo desactivará.',
    });
  }
  const ultima = versiones[0];
  if (ultima && !ultima.activo && ultima.metadata?.estado_revision === 'requiere_revision') avisos.push(avisoRevision(ultima));
  const evaluacion = activo?.metadata?.ultima_evaluacion;
  if (evaluacion && evaluacion.aprobado === false) avisos.push(avisoDesempeno(activo, evaluacion));
  return avisos;
}

// ---------------------------------------------------------------- consultas

/** Estado del modelo para la pantalla: versión activa, historial de versiones y avisos. */
async function listar({ repositorio = repositorioPorDefecto } = {}) {
  const versiones = await repositorio.listarModelos();
  const activo = versiones.find((modelo) => modelo.activo) ?? null;
  const otroActivo = await repositorio.obtenerModeloActivoOtro();
  const entrenamientos = await repositorio.listarEntrenamientos(1);
  return {
    umbral_rmse_relativo: CONFIG_ML.UMBRAL_RMSE_RELATIVO,
    parametros_por_defecto: demanda.PARAMETROS_POR_DEFECTO,
    modelo_activo: activo ? resumenVersion(activo) : null,
    versiones: versiones.map((modelo, indice) => resumenVersion(modelo, indice === 0)),
    ultimo_entrenamiento: entrenamientos[0] ? { ...entrenamientos[0], fecha: aIso(entrenamientos[0].fecha) } : null,
    avisos: construirAvisos(versiones, otroActivo),
  };
}

// ---------------------------------------------------------------- entrenar (ML-01, ML-02, ML-03)

/** ¿Se promueve el modelo nuevo? Debe cumplir el umbral y no empeorar al activo (medido sobre los mismos datos). */
function decidirPromocion({ aprobado, nuevo, actual, otroActivo = null }) {
  if (!aprobado) return { promover: false, resultado: 'exitoso', estadoRevision: 'requiere_revision' };
  // ml.modelos solo admite un modelo activo: si es de otro algoritmo, no se le quita el lugar.
  if (otroActivo) return { promover: false, resultado: 'exitoso', estadoRevision: 'sin_cupo' };
  if (actual && actual.rmse_relativo !== null && nuevo.rmse_relativo > actual.rmse_relativo) {
    return { promover: false, resultado: 'sin_mejora', estadoRevision: 'sin_mejora' };
  }
  return { promover: true, resultado: 'exitoso', estadoRevision: 'aprobado' };
}

function armarMetadata(resultado, ahora, estadoRevision, preparacion) {
  const m = resultado.metricas;
  return {
    nombre: demanda.NOMBRE_MODELO,
    parametros: resultado.parametros,
    demanda_promedio: m.demanda_promedio,
    rmse_relativo: m.rmse_relativo,
    evaluaciones: m.evaluaciones,
    productos_evaluados: resultado.productos_evaluados,
    umbral_rmse_relativo: resultado.umbral_rmse_relativo,
    aprobado: resultado.aprobado,
    estado_revision: estadoRevision,
    validacion: resultado.validacion,
    pruebas: resultado.pruebas,
    candidatos_probados: resultado.candidatos_probados,
    referencia: resultado.referencia,
    modelo_activo_al_entrenar: resultado.actual,
    datos: resultado.datos,
    preparacion,
    horizonte_evaluacion_dias: CONFIG_ML.HORIZONTE_EVALUACION,
    entrenado_en: ahora.toISOString(),
  };
}

function descripcionEntrenamiento(decision, resultado, otroActivo = null) {
  const m = resultado.metricas;
  const medidas =
    `RMSE relativo ${porcentaje(m.rmse_relativo)} (umbral ${porcentaje(resultado.umbral_rmse_relativo)}), ` +
    `MAE ${m.mae} y RMSE ${m.rmse} unidades por semana, sobre ${m.evaluaciones} pruebas de ${resultado.productos_evaluados} productos.`;
  const nota = resultado.validacion === 'mismos_datos'
    ? ' Hay poco historial para separar datos de medición: las métricas pueden ser optimistas.'
    : '';
  if (decision.estadoRevision === 'requiere_revision') {
    return `entrenado, pero requiere revisión antes de ponerse en uso. ${medidas}${nota}`;
  }
  if (decision.estadoRevision === 'sin_cupo') {
    return (
      `entrenado y cumple el umbral, pero no se activó porque ya hay un modelo activo de otro algoritmo ` +
      `(${otroActivo?.algoritmo}, ${etiqueta(otroActivo?.version)}) y ml.modelos solo admite uno. Actívalo manualmente si corresponde. ${medidas}${nota}`
    );
  }
  if (decision.estadoRevision === 'sin_mejora') {
    return (
      `entrenado, pero no mejora al modelo activo (RMSE relativo ${porcentaje(m.rmse_relativo)} frente a ` +
      `${porcentaje(resultado.actual?.rmse_relativo)} del activo, medidos sobre los mismos datos). Se conserva el modelo activo. ${medidas}${nota}`
    );
  }
  return `entrenado y activado. ${medidas}${nota}`;
}

/**
 * Entrena (o reentrena) con TODO el historial de ventas disponible y registra una nueva versión.
 * Reentrenar con datos nuevos es volver a ejecutarlo: siempre toma las ventas más recientes (TC-05).
 */
async function entrenarModelo({ ahora = new Date(), repositorio = repositorioPorDefecto, config = CONFIG_ML, disparadoPor = 'manual' } = {}) {
  if (entrenando) throw new ErrorML('Ya hay un entrenamiento en curso. Espera a que termine.', 'entrenamiento_en_curso', 409);
  entrenando = true;
  try {
    const hasta = demanda.ultimoDiaCompleto(ahora);
    const rango = demanda.rangoConsultaUtc(hasta, config.VENTANA_ENTRENAMIENTO_DIAS);
    const ventas = await repositorio.ventas(rango.desde, rango.hasta);

    const preparacion = entrenamiento.resumirPreparacion(ventas);
    const minimoFilas = (await repositorio.minimoFilasEntrenamiento()) ?? config.MIN_FILAS_ENTRENAMIENTO;

    let resultado = null;
    let motivoInsuficiente = null;
    if (preparacion.filas_validas < minimoFilas) {
      motivoInsuficiente =
        `No hay datos históricos suficientes: hay ${preparacion.filas_validas} filas de ventas válidas y se necesitan al menos ` +
        `${minimoFilas} (configuración min_filas_entrenamiento).`;
    } else {
      const activo = await repositorio.obtenerModeloActivo();
      const parametrosActivos = activo?.parametros ? demanda.normalizarParametros(activo.parametros) : null;
      resultado = entrenamiento.entrenar(ventas, { hasta, config, parametrosActivos });
      if (!resultado.ok) motivoInsuficiente = resultado.mensaje;
    }

    if (motivoInsuficiente) {
      await intentar(() => repositorio.registrarPreparacion({ ...preparacion, listo_para_entrenar: false }));
      await intentar(() => repositorio.registrarEntrenamiento({
        modeloId: null, disparadoPor, resultado: 'insuficiente_datos', promovido: false, mensaje: motivoInsuficiente,
      }));
      throw new ErrorML(motivoInsuficiente, 'datos_insuficientes', 422);
    }
    await intentar(() => repositorio.registrarPreparacion({ ...preparacion, listo_para_entrenar: true }));

    const otroActivo = await repositorio.obtenerModeloActivoOtro();
    const decision = decidirPromocion({ aprobado: resultado.aprobado, nuevo: resultado.metricas, actual: resultado.actual, otroActivo });
    const descripcion = descripcionEntrenamiento(decision, resultado, otroActivo);
    const registrado = await repositorio.registrarModelo({
      metadata: armarMetadata(resultado, ahora, decision.estadoRevision, preparacion),
      mae: resultado.metricas.mae,
      rmse: resultado.metricas.rmse,
      filas_entrenamiento: preparacion.filas_validas,
      notas: descripcion.charAt(0).toUpperCase() + descripcion.slice(1),
      activar: decision.promover,
    });

    // Si justo antes de guardar otro proceso tomó el lugar de modelo activo, no se promueve.
    const activado = decision.promover && !registrado.bloqueado_por;
    const mensaje = registrado.bloqueado_por && decision.promover
      ? `Modelo ${etiqueta(registrado.version)} ${descripcionEntrenamiento({ estadoRevision: 'sin_cupo' }, resultado, registrado.bloqueado_por)}`
      : `Modelo ${etiqueta(registrado.version)} ${descripcion}`;
    await intentar(() => repositorio.registrarEntrenamiento({
      modeloId: registrado.id, disparadoPor, resultado: decision.resultado, promovido: activado, mensaje,
    }));

    return {
      modelo: resumenVersion(registrado),
      activado,
      mensaje,
      aviso: decision.estadoRevision === 'requiere_revision' ? avisoRevision(registrado) : null,
    };
  } finally {
    entrenando = false;
  }
}

// ---------------------------------------------------------------- activar versión / evaluar desempeño

/** Pone una versión guardada como modelo activo (por ejemplo, tras revisar una que requería revisión). */
async function activarVersion(id, { ahora = new Date(), repositorio = repositorioPorDefecto } = {}) {
  const modelo = await repositorio.obtenerModelo(id);
  if (!modelo || modelo.algoritmo !== repositorioPorDefecto.ALGORITMO) {
    throw new ErrorML('La versión del modelo no existe.', 'modelo_no_encontrado', 404);
  }
  const activado = await repositorio.activarModelo(id, {
    estado_revision: 'activado_manualmente',
    activado_en: ahora.toISOString(),
  });
  const reemplazado = activado.desactivado && activado.desactivado.algoritmo !== repositorioPorDefecto.ALGORITMO
    ? ` Se desactivó el modelo de otro algoritmo (${activado.desactivado.algoritmo}, ${etiqueta(activado.desactivado.version)}).`
    : '';
  return { modelo: resumenVersion(activado), mensaje: `El modelo ${etiqueta(activado.version)} quedó activo.${reemplazado}` };
}

/**
 * TC-07: vuelve a medir el modelo activo (o los parámetros por defecto si no hay) con las ventas de los
 * últimos días. Si el RMSE relativo supera el umbral, devuelve un aviso y lo deja guardado en el modelo.
 */
async function evaluarModeloActivo({ ahora = new Date(), repositorio = repositorioPorDefecto, config = CONFIG_ML } = {}) {
  const activo = await repositorio.obtenerModeloActivo();
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
  if (activo) await repositorio.actualizarMetadata(activo.id, { ultima_evaluacion: evaluacion });

  const aviso = resultado.aprobado ? null : avisoDesempeno(activo, evaluacion);
  return {
    modelo: activo ? resumenVersion(activo) : null,
    evaluacion,
    aviso,
    mensaje: resultado.aprobado
      ? `El desempeño es aceptable: RMSE relativo ${porcentaje(evaluacion.rmse_relativo)} (umbral ${porcentaje(evaluacion.umbral_rmse_relativo)}).`
      : aviso.mensaje,
  };
}

module.exports = {
  ErrorML,
  decidirPromocion,
  listar: conTraduccion(listar),
  entrenarModelo: conTraduccion(entrenarModelo),
  activarVersion: conTraduccion(activarVersion),
  evaluarModeloActivo: conTraduccion(evaluarModeloActivo),
};
