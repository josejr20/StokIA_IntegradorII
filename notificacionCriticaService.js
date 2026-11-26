'use strict';

/**
 * US-32 — Notificar alertas críticas por correo electrónico.
 *
 *  BE-01 (HU-164): `notificarAlertaCritica` envía el correo (producto, motivo, nivel de riesgo).
 *  BE-02 (HU-165): los destinatarios se resuelven por rol (`obtenerConfiguracion` / `guardarConfiguracion`).
 *  BE-03 (HU-166): cada envío queda en `notificaciones_correo` (historial) y los fallidos se reintentan
 *                  con espera creciente desde `procesarReintentos` (lo invoca el cron o el endpoint).
 *
 * El servicio no toca la base de datos ni SMTP directamente: recibe un repositorio y una función
 * `enviarCorreo` (por defecto los reales), de modo que se puede probar sin infraestructura.
 * El repositorio siempre devuelve objetos planos (no instancias de Sequelize).
 */

const config = require('../config');
const loggerPorDefecto = require('../utils/logger');
const {
  TIPOS_NOTIFICABLES,
  ROLES_POR_DEFECTO,
  esAlertaCritica,
  esAlertaAbierta,
  normalizarEmail,
  construirCorreoCritico,
  calcularMinutosReintento,
  resumirError,
} = require('./reglasNotificacionCritica');

const ESTADOS_HISTORIAL = ['pendiente', 'enviado', 'fallido'];
/** Tiempo durante el cual un envío en curso queda "reservado" para que ningún otro proceso lo repita. */
const MINUTOS_RESERVA = 10;

class ErrorNotificacion extends Error {
  constructor(mensaje, status = 400) {
    super(mensaje);
    this.name = 'ErrorNotificacion';
    this.status = status;
  }
}

/**
 * Completa las dependencias que no se inyectaron. El repositorio (Sequelize) y el SMTP se cargan
 * solo cuando hacen falta, de modo que inyectar los dos permite usar el servicio sin base de datos.
 */
function resolverDeps(deps = {}) {
  const resueltas = {
    logger: loggerPorDefecto,
    maxIntentos: config.NOTIFICACIONES_MAX_INTENTOS,
    minutosBase: config.NOTIFICACIONES_REINTENTO_MINUTOS,
    timeoutEnvioMs: config.NOTIFICACIONES_TIMEOUT_ENVIO_MS,
    ahora: () => new Date(),
    ...deps,
  };
  resueltas.repo ??= require('./notificacionCriticaRepositorio');
  resueltas.enviarCorreo ??= require('./correoService').enviarCorreo;
  return resueltas;
}

const sumarMinutos = (fecha, minutos) => new Date(fecha.getTime() + minutos * 60_000);

/** Evita que un SMTP colgado bloquee el registro de alertas o el worker. */
function enviarConTimeout(enviar, ms) {
  let temporizador;
  const limite = new Promise((_, rechazar) => {
    // Sin unref(): el límite de espera debe dispararse siempre, aunque nada más mantenga vivo el proceso.
    temporizador = setTimeout(() => rechazar(new Error(`El servicio de correo no respondió en ${ms} ms`)), ms);
  });
  return Promise.race([Promise.resolve().then(enviar), limite]).finally(() => clearTimeout(temporizador));
}

// ---------------------------------------------------------------- destinatarios (HU-165)

/**
 * TC-05: correos a notificar para un tipo de alerta, según los roles configurados.
 * Si todavía no hay ninguna fila guardada para el tipo se usan los roles por defecto;
 * si el administrador desactivó todos los roles, nadie recibe correo.
 */
async function resolverDestinatarios(tipo, deps) {
  const { repo } = deps;
  const { hayConfiguracion, roles } = await repo.rolesConfigurados(tipo);
  const nombresRol = hayConfiguracion ? roles : ROLES_POR_DEFECTO;
  if (!nombresRol.length) return [];
  const usuarios = await repo.usuariosActivosPorRol(nombresRol);
  const porCorreo = new Map();
  for (const usuario of usuarios) {
    const email = normalizarEmail(usuario.email);
    if (email && !porCorreo.has(email)) porCorreo.set(email, { email, rol: usuario.rol });
  }
  return [...porCorreo.values()];
}

// ---------------------------------------------------------------- envío + registro (HU-164, HU-166)

/**
 * Hace un intento de envío para un registro del historial y lo deja actualizado:
 *  - éxito  → estado 'enviado', sin reintento pendiente.
 *  - fallo  → TC-02: estado 'fallido', error guardado y `proximo_reintento` (hasta agotar los intentos).
 */
async function intentarEnvio(registro, correo, deps) {
  const { repo, enviarCorreo, logger, maxIntentos, minutosBase, timeoutEnvioMs, ahora } = deps;
  const intentos = (registro.intentos ?? 0) + 1;
  try {
    await enviarConTimeout(() => enviarCorreo(registro.destinatario, correo.asunto, correo.html), timeoutEnvioMs);
    await repo.actualizarRegistro(registro, {
      estado: 'enviado',
      asunto: correo.asunto,
      fecha_envio: ahora(),
      intentos,
      ultimo_error: null,
      proximo_reintento: null,
    });
    return 'enviado';
  } catch (error) {
    const agotado = intentos >= maxIntentos;
    const proximo = agotado ? null : sumarMinutos(ahora(), calcularMinutosReintento(intentos, minutosBase));
    await repo.actualizarRegistro(registro, {
      estado: 'fallido',
      asunto: correo.asunto,
      fecha_envio: null,
      intentos,
      ultimo_error: resumirError(error),
      proximo_reintento: proximo,
    });
    logger.error(
      `No se pudo enviar la alerta ${registro.alerta_id} a ${registro.destinatario} (intento ${intentos}/${maxIntentos}): ${resumirError(error)}`
      + (agotado ? ' — se agotaron los reintentos' : ` — se reintentará ${proximo.toISOString()}`),
    );
    return 'fallido';
  }
}

async function contextoSeguro(repo, alerta, logger) {
  try {
    return (await repo.contextoAlerta(alerta)) ?? {};
  } catch (error) {
    logger.warn(`No se pudo ampliar el contexto de la alerta ${alerta.id}: ${error.message}`);
    return {};
  }
}

/**
 * TC-01 / TC-03 / TC-04: si la alerta es crítica y sigue abierta, envía un correo a cada
 * destinatario de los roles configurados y deja cada envío en el historial.
 *
 * Es idempotente: una alerta se notifica una sola vez por destinatario (los fallos los retoma
 * `procesarReintentos`). Nunca lanza: un fallo de correo no debe impedir registrar la alerta.
 */
async function notificarAlertaCritica(alerta, depsParciales = {}) {
  const deps = resolverDeps(depsParciales);
  const { repo, logger, ahora } = deps;
  const resultado = { destinatarios: 0, enviados: 0, fallidos: 0, omitidos: 0, motivo: null };
  try {
    if (!esAlertaCritica(alerta)) return { ...resultado, motivo: 'no_critica' };
    if (!esAlertaAbierta(alerta)) return { ...resultado, motivo: 'no_abierta' };
    if (!alerta.id) return { ...resultado, motivo: 'alerta_sin_id' };

    const destinatarios = await resolverDestinatarios(alerta.tipo, deps);
    if (!destinatarios.length) {
      logger.warn(`Alerta crítica ${alerta.id} sin destinatarios configurados para ${alerta.tipo}`);
      return { ...resultado, motivo: 'sin_destinatarios' };
    }
    resultado.destinatarios = destinatarios.length;

    const correo = construirCorreoCritico(alerta, await contextoSeguro(repo, alerta, logger));
    for (const { email, rol } of destinatarios) {
      if (await repo.buscarRegistro(alerta.id, email)) {
        resultado.omitidos += 1; // ya notificado (o en reintento) para esta alerta
        continue;
      }
      const registro = await repo.crearRegistro({
        alerta_id: alerta.id,
        destinatario: email,
        rol: rol ?? null,
        asunto: correo.asunto,
        estado: 'pendiente',
        proveedor: 'smtp',
        intentos: 0,
        // Si el proceso se cae a mitad del envío, el worker lo retoma pasada la reserva.
        proximo_reintento: sumarMinutos(ahora(), MINUTOS_RESERVA),
      });
      const estado = await intentarEnvio(registro, correo, deps);
      if (estado === 'enviado') resultado.enviados += 1;
      else resultado.fallidos += 1;
    }
    if (!resultado.enviados && !resultado.fallidos) resultado.motivo = 'ya_notificada';
    return resultado;
  } catch (error) {
    logger.error(`Error notificando la alerta crítica ${alerta?.id}: ${error.message}`);
    return { ...resultado, motivo: 'error_interno' };
  }
}

/**
 * TC-02 / TC-07: reintenta los envíos fallidos cuyo `proximo_reintento` ya venció.
 * Cada registro se reserva de forma atómica antes de enviarlo, así que dos ejecuciones
 * simultáneas (cron + botón manual) nunca envían el mismo correo dos veces.
 */
async function procesarReintentos({ limite = 50, ...depsParciales } = {}) {
  const deps = resolverDeps(depsParciales);
  const { repo, logger, ahora, maxIntentos } = deps;
  const resumen = { revisados: 0, enviados: 0, fallidos: 0, cancelados: 0, omitidos: 0 };
  const momento = ahora();
  const candidatos = await repo.pendientesDeReintento(momento, limite);

  for (const registro of candidatos) {
    resumen.revisados += 1;
    try {
      const reservado = await repo.reservarRegistro(registro.id, momento, sumarMinutos(momento, MINUTOS_RESERVA));
      if (!reservado) { resumen.omitidos += 1; continue; }

      if ((registro.intentos ?? 0) >= maxIntentos) {
        await repo.actualizarRegistro(registro, { estado: 'fallido', proximo_reintento: null });
        resumen.cancelados += 1;
        continue;
      }
      const alerta = registro.alerta_id ? await repo.buscarAlerta(registro.alerta_id) : null;
      if (!alerta || !esAlertaAbierta(alerta) || !esAlertaCritica(alerta)) {
        await repo.actualizarRegistro(registro, {
          estado: 'fallido',
          proximo_reintento: null,
          ultimo_error: 'Reintento cancelado: la alerta ya no está activa o dejó de ser crítica',
        });
        resumen.cancelados += 1;
        continue;
      }
      const correo = construirCorreoCritico(alerta, await contextoSeguro(repo, alerta, logger));
      const estado = await intentarEnvio(registro, correo, deps);
      if (estado === 'enviado') resumen.enviados += 1;
      else resumen.fallidos += 1;
    } catch (error) {
      resumen.fallidos += 1;
      logger.error(`Error reintentando la notificación ${registro.id}: ${error.message}`);
    }
  }
  if (resumen.revisados) logger.info(`Reintentos de notificaciones críticas: ${JSON.stringify(resumen)}`);
  return resumen;
}

// ---------------------------------------------------------------- historial (HU-166)

function fechaOpcional(valor, nombre) {
  if (valor === undefined || valor === null || valor === '') return null;
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) throw new ErrorNotificacion(`El filtro «${nombre}» no es una fecha válida`);
  return fecha;
}

/** TC-06: historial de notificaciones enviadas (y fallidas/pendientes), con filtros y paginación. */
async function obtenerHistorial(filtros = {}, depsParciales = {}) {
  const { repo } = resolverDeps(depsParciales);
  const { estado, alerta_id: alertaId, destinatario } = filtros;
  if (estado && !ESTADOS_HISTORIAL.includes(estado)) {
    throw new ErrorNotificacion(`El estado debe ser uno de: ${ESTADOS_HISTORIAL.join(', ')}`);
  }
  if (alertaId !== undefined && alertaId !== '' && !/^\d+$/.test(String(alertaId))) {
    throw new ErrorNotificacion('alerta_id debe ser un número entero');
  }
  const pagina = Math.max(1, parseInt(filtros.pagina, 10) || 1);
  const limite = Math.min(100, Math.max(1, parseInt(filtros.limite, 10) || 20));
  const resultado = await repo.historial({
    estado: estado || null,
    alertaId: alertaId ? Number(alertaId) : null,
    destinatario: destinatario ? String(destinatario).trim().toLowerCase() : null,
    desde: fechaOpcional(filtros.desde, 'desde'),
    hasta: fechaOpcional(filtros.hasta, 'hasta'),
    pagina,
    limite,
  });
  return { data: resultado.filas, total: resultado.total, pagina, limite };
}

// ---------------------------------------------------------------- configuración por rol (HU-165)

/** TC-05: roles del sistema y si reciben las alertas críticas de cada tipo. */
async function obtenerConfiguracion(depsParciales = {}) {
  const { repo } = resolverDeps(depsParciales);
  const [roles, filas] = await Promise.all([repo.listarRoles(), repo.listarConfiguracion()]);
  const porRol = new Map();
  for (const fila of filas) {
    const actual = porRol.get(Number(fila.rol_id)) ?? {};
    actual[fila.tipo_alerta] = fila.activo === true;
    porRol.set(Number(fila.rol_id), actual);
  }
  const tiposConFilas = new Set(filas.map((fila) => fila.tipo_alerta));
  const rolesPorDefecto = new Set(ROLES_POR_DEFECTO.map((nombre) => nombre.toLowerCase()));

  return {
    tipos: TIPOS_NOTIFICABLES,
    roles_por_defecto: ROLES_POR_DEFECTO,
    data: roles.map((rol) => {
      const guardado = porRol.get(Number(rol.id)) ?? {};
      const fila = { rol_id: Number(rol.id), rol: rol.nombre };
      for (const tipo of TIPOS_NOTIFICABLES) {
        // Sin filas para el tipo, aplica el valor por defecto (solo los roles por defecto reciben).
        fila[tipo] = tiposConFilas.has(tipo)
          ? guardado[tipo] === true
          : rolesPorDefecto.has(String(rol.nombre).toLowerCase());
      }
      return fila;
    }),
  };
}

/**
 * TC-05: guarda qué roles reciben cada tipo de alerta.
 * `destinatarios` = [{ rol_id, riesgo_vencimiento: boolean, bajo_stock: boolean }]; los roles
 * que no se envían quedan como estaban. Si se guarda un tipo por primera vez, el resto de
 * roles queda explícitamente desactivado (para que dejen de aplicar los valores por defecto).
 */
async function guardarConfiguracion(destinatarios, depsParciales = {}) {
  const { repo } = resolverDeps(depsParciales);
  if (!Array.isArray(destinatarios) || destinatarios.length === 0) {
    throw new ErrorNotificacion('Envíe al menos un rol en «destinatarios»');
  }
  const roles = await repo.listarRoles();
  const idsRol = new Set(roles.map((rol) => Number(rol.id)));
  const cambios = new Map();
  for (const item of destinatarios) {
    const rolId = Number(item?.rol_id);
    if (!Number.isInteger(rolId) || !idsRol.has(rolId)) {
      throw new ErrorNotificacion(`El rol ${item?.rol_id} no existe`, 404);
    }
    const fila = { rol_id: rolId };
    for (const tipo of TIPOS_NOTIFICABLES) {
      if (item[tipo] === undefined) continue;
      if (typeof item[tipo] !== 'boolean') {
        throw new ErrorNotificacion(`«${tipo}» debe ser verdadero o falso`);
      }
      fila[tipo] = item[tipo];
    }
    cambios.set(rolId, { ...(cambios.get(rolId) ?? {}), ...fila });
  }

  // Si un tipo aún no tenía filas, materializa el estado actual (valores por defecto) de los demás roles.
  const existentes = await repo.listarConfiguracion();
  const tiposConFilas = new Set(existentes.map((fila) => fila.tipo_alerta));
  const rolesPorDefecto = new Set(ROLES_POR_DEFECTO.map((nombre) => nombre.toLowerCase()));
  const filasAGuardar = [];
  for (const tipo of TIPOS_NOTIFICABLES) {
    if (!tiposConFilas.has(tipo)) {
      for (const rol of roles) {
        if (cambios.get(Number(rol.id))?.[tipo] !== undefined) continue;
        filasAGuardar.push({
          rol_id: Number(rol.id),
          tipo_alerta: tipo,
          activo: rolesPorDefecto.has(String(rol.nombre).toLowerCase()),
        });
      }
    }
    for (const [rolId, fila] of cambios) {
      if (fila[tipo] !== undefined) filasAGuardar.push({ rol_id: rolId, tipo_alerta: tipo, activo: fila[tipo] });
    }
  }
  await repo.guardarConfiguracion(filasAGuardar);
  return obtenerConfiguracion(depsParciales);
}

module.exports = {
  ErrorNotificacion,
  MINUTOS_RESERVA,
  notificarAlertaCritica,
  procesarReintentos,
  obtenerHistorial,
  obtenerConfiguracion,
  guardarConfiguracion,
  resolverDestinatarios,
};
