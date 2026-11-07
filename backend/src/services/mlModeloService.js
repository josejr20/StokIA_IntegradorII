'use strict';

/**
 * HU-78 — Ciclo de vida del modelo de demanda: entrenar, evaluar, versionar y avisar.
 *
 * - Cada entrenamiento genera una versión en ml.modelos y un registro en ml.entrenamientos_log (TC-01, TC-06).
 * - Se promueve (queda activa y la usa la predicción de HU-72) solo si cumple el umbral de RMSE relativo y no
 *   empeora al modelo activo medido sobre los mismos datos. Si no cumple el umbral, queda "requiere revisión" y
 *   se avisa al administrador (TC-02). Si cumple pero no mejora, queda como "sin_mejora".
 * - El desempeño del modelo activo se puede volver a medir con las ventas recientes (TC-07).
 *
 * HU-82 (entrenar el modelo de predicción de demanda) reutiliza este ciclo y agrega:
 *  - Fecha de inicio/fin y DURACIÓN de cada entrenamiento (TC-05), guardadas en la versión y en la bitácora.
 *  - Aviso explícito y detallado cuando no hay datos suficientes (TC-02/TC-06): el error 422 incluye `detalle`.
 *  - Una confirmación completa para el administrador (TC-07): versión, fecha, duración, datos usados y métricas.
 */

const demanda = require('./prediccionDemandaModelo');
const entrenamiento = require('./mlEntrenamientoModelo');
const repositorioPorDefecto = require('./mlModeloRepositorio');

const { CONFIG_ML } = entrenamiento;

class ErrorML extends Error {
  /** `detalle` (opcional) son datos estructurados para que la pantalla explique el motivo con números. */
  constructor(mensaje, codigo, estadoHttp = 422, detalle = null) {
    super(mensaje);
    this.codigo = codigo;
    this.estadoHttp = estadoHttp;
    this.detalle = detalle;
  }
}

const MAX_HISTORIAL_EVALUACIONES = 30;

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

/** TC-05: duración legible (ej. "850 ms", "1,4 s", "2 min 5 s"). */
function duracionTexto(ms) {
  if (ms === null || ms === undefined || Number.isNaN(Number(ms))) return null;
  const total = Math.max(0, Number(ms));
  if (total < 1000) return `${Math.round(total)} ms`;
  // Formato propio (coma decimal) para no depender del idioma/ICU instalado en el servidor.
  if (total < 60000) return `${String(Math.round(total / 100) / 10).replace('.', ',')} s`;
  const minutos = Math.floor(total / 60000);
  const segundos = Math.round((total % 60000) / 1000);
  return `${minutos} min ${segundos} s`;
}

/** TC-05: arma el registro de fecha de inicio, fecha de fin y duración a partir de un reloj (ms desde 1970). */
function medirTiempo(inicioMs, finMs) {
  const duracion = Math.max(0, Math.round(finMs - inicioMs));
  return { iniciado_en: new Date(inicioMs).toISOString(), finalizado_en: new Date(finMs).toISOString(), duracion_ms: duracion };
}

/** Cómo se muestra una versión: activa, requiere revisión (solo la última no activada) o archivada. */
function estadoVisible(modelo, esUltima) {
  if (modelo.activo) return 'activo';
  if (esUltima && modelo.metadata?.estado_revision === 'requiere_revision') return 'requiere_revision';
  return 'archivado';
}

/**
 * HU-88 / TC-02 y TC-06: una versión "requiere revisión" cuando su error supera el umbral aceptable, ya sea por las
 * métricas con las que se entrenó o, si es la activa, por su última evaluación con ventas recientes.
 */
function requiereRevision(modelo) {
  const m = modelo.metadata ?? {};
  const umbral = m.umbral_rmse_relativo ?? CONFIG_ML.UMBRAL_RMSE_RELATIVO;
  if (modelo.activo && m.ultima_evaluacion) return m.ultima_evaluacion.aprobado === false;
  if (m.rmse_relativo === null || m.rmse_relativo === undefined) return false;
  return m.rmse_relativo > umbral;
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
    entrenamiento: m.entrenamiento ? { ...m.entrenamiento, duracion_texto: duracionTexto(m.entrenamiento.duracion_ms) } : null,
    ultima_evaluacion: m.ultima_evaluacion ?? null,
    requiere_revision: requiereRevision(modelo),
  };
}

/** Un intento de entrenamiento de la bitácora (ml.entrenamientos_log) tal como lo ve la pantalla. */
function resumenEntrenamiento(fila) {
  const duracion = fila.duracion_ms === undefined || fila.duracion_ms === null ? null : Number(fila.duracion_ms);
  return {
    ...fila,
    fecha: aIso(fila.fecha),
    iniciado_en: aIso(fila.iniciado_en),
    finalizado_en: aIso(fila.finalizado_en),
    duracion_ms: duracion,
    duracion_texto: duracionTexto(duracion),
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
  const entrenamientos = (await repositorio.listarEntrenamientos(10)).map(resumenEntrenamiento);
  return {
    umbral_rmse_relativo: CONFIG_ML.UMBRAL_RMSE_RELATIVO,
    parametros_por_defecto: demanda.PARAMETROS_POR_DEFECTO,
    modelo_activo: activo ? resumenVersion(activo) : null,
    versiones: versiones.map((modelo, indice) => resumenVersion(modelo, indice === 0)),
    ultimo_entrenamiento: entrenamientos[0] ?? null,
    entrenamientos, // TC-05/TC-06: últimos intentos (también los que fallaron por falta de datos), con fecha y duración
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

function armarMetadata(resultado, ahora, estadoRevision, preparacion, tiempo) {
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
    entrenamiento: tiempo, // TC-05: fecha de inicio, fecha de fin y duración
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
 * HU-82 · Entrena (o reentrena) con TODO el historial de ventas disponible y registra una nueva versión.
 * Reentrenar con datos nuevos es volver a ejecutarlo: siempre toma las ventas más recientes.
 *
 *  1. (ML-01 / TC-03) Carga las ventas, las prepara (descarta filas inválidas) y valida que alcancen para entrenar.
 *  2. (BE-01 / TC-02, TC-06) Si no alcanzan, NO entrena: registra el intento y responde 422 con el motivo y el detalle.
 *  3. (ML-01) Busca los parámetros que mejor predicen y mide su desempeño con datos que no usó para elegirlos.
 *  4. (ML-02 / TC-01, TC-04) Guarda una versión nueva en ml.modelos (las anteriores se conservan).
 *  5. (BE-01 / TC-05) Registra fecha de inicio, de fin y duración, en la versión y en la bitácora.
 *  6. (TC-07) Devuelve la confirmación que la pantalla muestra al administrador.
 *
 * `reloj` devuelve milisegundos desde 1970 y se puede reemplazar en las pruebas para fijar la duración.
 * La duración cuenta desde que arranca el entrenamiento hasta que el modelo está calculado, justo antes de guardarlo.
 */
async function entrenarModelo({
  ahora = new Date(),
  repositorio = repositorioPorDefecto,
  config = CONFIG_ML,
  disparadoPor = 'manual',
  reloj = Date.now,
} = {}) {
  if (entrenando) throw new ErrorML('Ya hay un entrenamiento en curso. Espera a que termine.', 'entrenamiento_en_curso', 409);
  entrenando = true;
  const inicioMs = reloj();
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
      // TC-02 / TC-06: no se entrena. El intento queda registrado (con su fecha y duración) y se avisa con el detalle.
      const tiempo = medirTiempo(inicioMs, reloj());
      const mensajeError = `${motivoInsuficiente} No es posible entrenar el modelo con la información disponible.`;
      await intentar(() => repositorio.registrarPreparacion({ ...preparacion, listo_para_entrenar: false }));
      await intentar(() => repositorio.registrarEntrenamiento({
        modeloId: null,
        disparadoPor,
        resultado: 'insuficiente_datos',
        promovido: false,
        mensaje: `${mensajeError} Duración: ${duracionTexto(tiempo.duracion_ms)}.`,
        duracionMs: tiempo.duracion_ms,
        iniciadoEn: tiempo.iniciado_en,
        finalizadoEn: tiempo.finalizado_en,
      }));
      throw new ErrorML(mensajeError, 'datos_insuficientes', 422, {
        filas_totales: preparacion.total_filas,
        filas_validas: preparacion.filas_validas,
        filas_descartadas: preparacion.filas_descartadas,
        motivos_descarte: preparacion.motivos_descarte,
        minimo_filas: minimoFilas,
        pruebas_logradas: resultado?.evaluaciones ?? null,
        pruebas_necesarias: resultado ? config.MIN_EVALUACIONES : null,
        ...tiempo,
        duracion_texto: duracionTexto(tiempo.duracion_ms),
      });
    }
    await intentar(() => repositorio.registrarPreparacion({ ...preparacion, listo_para_entrenar: true }));

    const otroActivo = await repositorio.obtenerModeloActivoOtro();
    const decision = decidirPromocion({ aprobado: resultado.aprobado, nuevo: resultado.metricas, actual: resultado.actual, otroActivo });
    const descripcion = descripcionEntrenamiento(decision, resultado, otroActivo);

    // TC-05: el modelo ya está calculado; se congela la duración antes de guardarlo.
    const tiempo = medirTiempo(inicioMs, reloj());
    const duracion = duracionTexto(tiempo.duracion_ms);
    const registrado = await repositorio.registrarModelo({
      metadata: armarMetadata(resultado, ahora, decision.estadoRevision, preparacion, tiempo),
      mae: resultado.metricas.mae,
      rmse: resultado.metricas.rmse,
      filas_entrenamiento: preparacion.filas_validas,
      notas: `${descripcion.charAt(0).toUpperCase() + descripcion.slice(1)} Duración del entrenamiento: ${duracion}.`,
      activar: decision.promover,
    });

    // Si justo antes de guardar otro proceso tomó el lugar de modelo activo, no se promueve.
    const activado = decision.promover && !registrado.bloqueado_por;
    const mensaje = registrado.bloqueado_por && decision.promover
      ? `Modelo ${etiqueta(registrado.version)} ${descripcionEntrenamiento({ estadoRevision: 'sin_cupo' }, resultado, registrado.bloqueado_por)}`
      : `Modelo ${etiqueta(registrado.version)} ${descripcion}`;
    const mensajeConDuracion = `${mensaje} Duración del entrenamiento: ${duracion}.`;
    await intentar(() => repositorio.registrarEntrenamiento({
      modeloId: registrado.id,
      disparadoPor,
      resultado: decision.resultado,
      promovido: activado,
      mensaje: mensajeConDuracion,
      duracionMs: tiempo.duracion_ms,
      iniciadoEn: tiempo.iniciado_en,
      finalizadoEn: tiempo.finalizado_en,
    }));

    return {
      modelo: resumenVersion(registrado),
      activado,
      mensaje: mensajeConDuracion,
      aviso: decision.estadoRevision === 'requiere_revision' ? avisoRevision(registrado) : null,
      entrenamiento: { ...tiempo, duracion_texto: duracion }, // TC-05
      datos_preparados: preparacion, // TC-03: con qué datos se entrenó
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
  if (activo) {
    // HU-88 / TC-07: cada evaluación se agrega al historial de la versión (no se pisa la anterior; se guardan las últimas 30).
    const historial = [...(activo.metadata?.historial_evaluaciones ?? []), evaluacion].slice(-MAX_HISTORIAL_EVALUACIONES);
    const parche = { ultima_evaluacion: evaluacion, historial_evaluaciones: historial };
    // HU-88 / TC-02 y TC-06: si el error supera el umbral, la versión activa queda marcada "requiere revisión".
    if (!resultado.aprobado) parche.estado_revision = 'requiere_revision';
    else if (activo.metadata?.estado_revision === 'requiere_revision') parche.estado_revision = 'aprobado';
    await repositorio.actualizarMetadata(activo.id, parche);
  }

  const aviso = resultado.aprobado ? null : avisoDesempeno(activo, evaluacion);
  const actualizado = activo ? await repositorio.obtenerModelo(activo.id) : null;
  return {
    modelo: actualizado ? resumenVersion(actualizado) : null,
    evaluacion,
    aviso,
    mensaje: resultado.aprobado
      ? `El desempeño es aceptable: RMSE relativo ${porcentaje(evaluacion.rmse_relativo)} (umbral ${porcentaje(evaluacion.umbral_rmse_relativo)}).`
      : aviso.mensaje,
  };
}

// ---------------------------------------------------------------- HU-88: métricas y comparación de versiones

/**
 * TC-04: nivel de calidad en palabras, según el RMSE relativo frente al umbral aceptable.
 *   buena (hasta 2/3 del umbral) · aceptable (hasta el umbral) · requiere_revision (supera el umbral)
 */
function nivelCalidad(rmseRelativo, umbral) {
  if (rmseRelativo === null || rmseRelativo === undefined) return 'sin_datos';
  if (rmseRelativo > umbral) return 'requiere_revision';
  return rmseRelativo <= (umbral * 2) / 3 + 1e-9 ? 'buena' : 'aceptable'; // 1e-9: evita errores de redondeo decimal
}

const unidades = (valor) => (valor ?? 0).toLocaleString('es-PE', { maximumFractionDigits: 1 });

/** TC-04: explica las métricas con palabras del negocio (unidades vendidas por semana), no con jerga. */
function interpretacion(version) {
  if (version.mae === null || version.rmse === null) return null;
  const relativo = version.rmse_relativo === null ? '' : ` Eso equivale a ${porcentaje(version.rmse_relativo)} de la demanda semanal promedio.`;
  return (
    `En promedio, la predicción semanal de un producto se equivoca en ${unidades(version.mae)} unidades (MAE). ` +
    `Los errores grandes pesan más: el RMSE es ${unidades(version.rmse)} unidades.${relativo}`
  );
}

/** Variación de una métrica entre dos versiones. Para MAE/RMSE un valor menor es mejor. */
function variacion(base, nueva) {
  if (base === null || base === undefined || nueva === null || nueva === undefined) return null;
  const diferencia = Math.round((nueva - base + Number.EPSILON) * 10000) / 10000;
  const porcentajeCambio = base === 0 ? null : Math.round(((nueva - base) / base) * 1000) / 10;
  return { base, nueva, diferencia, porcentaje: porcentajeCambio, tendencia: diferencia < 0 ? 'mejora' : diferencia > 0 ? 'empeora' : 'igual' };
}

/** TC-05: compara el desempeño de dos versiones (MAE, RMSE y RMSE relativo). */
function compararDos(filaBase, filaNueva) {
  const base = resumenVersion(filaBase, false); // valores ya normalizados (números, no texto de la BD)
  const nueva = resumenVersion(filaNueva, false);
  const mae = variacion(base.mae, nueva.mae);
  const rmse = variacion(base.rmse, nueva.rmse);
  const rmseRelativo = variacion(base.rmse_relativo, nueva.rmse_relativo);
  // El criterio de decisión es el RMSE relativo (es el que se compara con el umbral y no depende de la escala de ventas).
  const criterio = rmseRelativo ?? rmse;
  return {
    base: { id: base.id, version: base.version },
    nueva: { id: nueva.id, version: nueva.version },
    mae,
    rmse,
    rmse_relativo: rmseRelativo,
    veredicto: criterio ? criterio.tendencia : 'sin_datos',
  };
}

function resumenMetricas(modelo, umbralGlobal, esUltima) {
  const version = resumenVersion(modelo, esUltima);
  const umbral = modelo.metadata?.umbral_rmse_relativo ?? umbralGlobal; // el umbral con el que se juzgó esa versión
  return {
    id: version.id,
    version: version.version,
    estado: version.estado,
    fecha_entrenamiento: version.fecha_entrenamiento,
    mae: version.mae,
    rmse: version.rmse,
    demanda_promedio: version.demanda_promedio,
    rmse_relativo: version.rmse_relativo,
    mae_relativo: version.demanda_promedio > 0 && version.mae !== null ? Math.round((version.mae / version.demanda_promedio) * 10000) / 10000 : null,
    evaluaciones: version.evaluaciones,
    umbral_rmse_relativo: umbral,
    cumple_umbral: version.rmse_relativo !== null ? version.rmse_relativo <= umbral : null,
    calidad: nivelCalidad(version.rmse_relativo, umbral),
    requiere_revision: version.requiere_revision,
    interpretacion: interpretacion(version),
    ultima_evaluacion: version.ultima_evaluacion,
    historial_evaluaciones: modelo.metadata?.historial_evaluaciones ?? [],
  };
}

/**
 * HU-88 · Métricas de desempeño de todas las versiones, de la más reciente a la más antigua:
 *  - TC-01/TC-03/TC-04: MAE, RMSE y RMSE relativo de cada versión, con nivel de calidad y explicación.
 *  - TC-05: cada versión trae su comparación con la anterior (`vs_anterior`) y se indica la mejor versión.
 *  - TC-06: `requiere_revision` marca las versiones cuyo error supera el umbral.
 *  - TC-07: `historial_evaluaciones` conserva las evaluaciones con ventas recientes de cada versión.
 */
async function obtenerMetricas({ repositorio = repositorioPorDefecto } = {}) {
  const modelos = await repositorio.listarModelos();
  const umbral = CONFIG_ML.UMBRAL_RMSE_RELATIVO;
  const versiones = modelos.map((modelo, indice) => resumenMetricas(modelo, umbral, indice === 0));
  versiones.forEach((version, indice) => {
    const anterior = modelos[indice + 1]; // la lista viene de la más nueva a la más vieja
    version.vs_anterior = anterior ? compararDos(anterior, modelos[indice]) : null;
  });
  const conMetricas = versiones.filter((version) => version.rmse_relativo !== null);
  const mejor = conMetricas.reduce((a, b) => (a === null || b.rmse_relativo < a.rmse_relativo ? b : a), null);
  const activa = versiones.find((version) => version.estado === 'activo') ?? null;
  return {
    umbral_rmse_relativo: umbral,
    modelo_activo_id: activa?.id ?? null,
    mejor_version_id: mejor?.id ?? null,
    hay_modelo_entrenado: versiones.length > 0,
    versiones,
  };
}

/** TC-05: compara dos versiones cualesquiera. `idBase` es la de referencia y `idNueva` la que se evalúa frente a ella. */
async function compararVersiones(idBase, idNueva, { repositorio = repositorioPorDefecto } = {}) {
  if (idBase === idNueva) throw new ErrorML('Elige dos versiones distintas para compararlas.', 'comparacion_invalida', 400);
  const [base, nueva] = await Promise.all([repositorio.obtenerModelo(idBase), repositorio.obtenerModelo(idNueva)]);
  const valida = (modelo) => modelo && modelo.algoritmo === repositorioPorDefecto.ALGORITMO;
  if (!valida(base) || !valida(nueva)) throw new ErrorML('Alguna de las versiones a comparar no existe.', 'modelo_no_encontrado', 404);
  return compararDos(base, nueva);
}

module.exports = {
  ErrorML,
  duracionTexto,
  decidirPromocion,
  listar: conTraduccion(listar),
  entrenarModelo: conTraduccion(entrenarModelo),
  activarVersion: conTraduccion(activarVersion),
  evaluarModeloActivo: conTraduccion(evaluarModeloActivo),
  obtenerMetricas: conTraduccion(obtenerMetricas),
  compararVersiones: conTraduccion(compararVersiones),
  nivelCalidad,
};
