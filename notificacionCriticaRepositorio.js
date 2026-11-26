'use strict';

/**
 * US-32 — Acceso a datos de la notificación de alertas críticas (Sequelize / Supabase).
 *
 * Implementa el "repositorio" que consume `notificacionCriticaService`. Devuelve siempre objetos
 * planos (no instancias de Sequelize) para que el servicio no dependa del ORM y sea fácil de probar.
 */

const { Op } = require('sequelize');
const {
  sequelize,
  Alerta,
  Lote,
  Producto,
  Rol,
  Usuario,
  NotificacionCorreo,
  NotificacionDestinatarioRol,
} = require('../models');
const { NotificacionCorreoDto } = require('../dtos/notificacionCorreoDto');

const ESTADOS_REINTENTABLES = ['pendiente', 'fallido'];

const plano = (fila) => (fila ? fila.get({ plain: true }) : null);

// ---------------------------------------------------------------- destinatarios (HU-165)

/**
 * Roles que reciben las alertas de un tipo.
 * `hayConfiguracion` distingue "nunca se configuró" (aplican los roles por defecto) de
 * "se configuró y se desactivaron todos" (nadie recibe).
 */
async function rolesConfigurados(tipo) {
  const filas = await NotificacionDestinatarioRol.findAll({
    where: { tipo_alerta: tipo },
    include: [{ model: Rol, as: 'rol', attributes: ['id', 'nombre'] }],
  });
  return {
    hayConfiguracion: filas.length > 0,
    roles: filas.filter((fila) => fila.activo && fila.rol).map((fila) => fila.rol.nombre),
  };
}

/** Usuarios activos cuyo rol está en `nombresRol` (sin distinguir mayúsculas). */
async function usuariosActivosPorRol(nombresRol) {
  const buscados = new Set(nombresRol.map((nombre) => String(nombre).trim().toLowerCase()));
  const roles = (await Rol.findAll({ attributes: ['id', 'nombre'], raw: true }))
    .filter((rol) => buscados.has(String(rol.nombre).trim().toLowerCase()));
  if (!roles.length) return [];
  const nombrePorId = new Map(roles.map((rol) => [Number(rol.id), rol.nombre]));
  const usuarios = await Usuario.findAll({
    where: { activo: true, rol_id: { [Op.in]: [...nombrePorId.keys()] } },
    attributes: ['id', 'email', 'rol_id'],
    order: [['id', 'ASC']],
    raw: true,
  });
  return usuarios.map((usuario) => ({ email: usuario.email, rol: nombrePorId.get(Number(usuario.rol_id)) }));
}

async function listarRoles() {
  return Rol.findAll({ attributes: ['id', 'nombre'], order: [['nombre', 'ASC']], raw: true });
}

async function listarConfiguracion() {
  return NotificacionDestinatarioRol.findAll({
    attributes: ['rol_id', 'tipo_alerta', 'activo'],
    raw: true,
  });
}

/** Guarda todas las filas o ninguna (transacción) para no dejar la configuración a medias. */
async function guardarConfiguracion(filas) {
  if (!filas.length) return;
  await sequelize.transaction(async (transaction) => {
    for (const fila of filas) {
      await NotificacionDestinatarioRol.upsert(
        { ...fila, fecha_actualizacion: new Date() },
        { conflictFields: ['rol_id', 'tipo_alerta'], transaction },
      );
    }
  });
}

// ---------------------------------------------------------------- historial y reintentos (HU-166)

async function buscarRegistro(alertaId, destinatario) {
  return NotificacionCorreo.findOne({
    where: { alerta_id: alertaId, destinatario },
    order: [['id', 'ASC']],
    raw: true,
  });
}

async function crearRegistro(datos) {
  return plano(await NotificacionCorreo.create(datos));
}

/** Actualiza el registro en la base y también el objeto recibido (para que el servicio lo vea al día). */
async function actualizarRegistro(registro, cambios) {
  await NotificacionCorreo.update(cambios, { where: { id: registro.id } });
  Object.assign(registro, cambios);
  return registro;
}

/** Envíos fallidos (o "en curso" que quedaron colgados) cuyo reintento ya venció, los más antiguos primero. */
async function pendientesDeReintento(momento, limite) {
  return NotificacionCorreo.findAll({
    where: {
      estado: { [Op.in]: ESTADOS_REINTENTABLES },
      proximo_reintento: { [Op.ne]: null, [Op.lte]: momento },
    },
    order: [['proximo_reintento', 'ASC'], ['id', 'ASC']],
    limit: limite,
    raw: true,
  });
}

/**
 * Reserva atómica de un registro: empuja `proximo_reintento` hacia el futuro solo si todavía
 * estaba vencido. Es un único UPDATE condicional, así que si dos procesos (cron + botón manual)
 * compiten, solo uno obtiene `true` y el otro lo omite.
 */
async function reservarRegistro(id, momento, nuevoProximo) {
  const [afectados] = await NotificacionCorreo.update(
    { proximo_reintento: nuevoProximo },
    {
      where: {
        id,
        estado: { [Op.in]: ESTADOS_REINTENTABLES },
        proximo_reintento: { [Op.ne]: null, [Op.lte]: momento },
      },
    },
  );
  return afectados === 1;
}

async function buscarAlerta(id) {
  return Alerta.findByPk(id, { raw: true });
}

/** Producto y lote de la alerta: datos que el correo necesita y que la alerta no siempre guarda. */
async function contextoAlerta(alerta) {
  const [producto, lote] = await Promise.all([
    alerta.producto_id
      ? Producto.findByPk(alerta.producto_id, { attributes: ['codigo', 'nombre'], raw: true })
      : null,
    alerta.lote_id
      ? Lote.findByPk(alerta.lote_id, {
        attributes: ['numero_lote', 'fecha_vencimiento', 'cantidad_actual'],
        raw: true,
      })
      : null,
  ]);
  return { producto: producto ?? undefined, lote: lote ?? undefined };
}

/** TC-06: historial paginado, del más reciente al más antiguo. */
async function historial({ estado, alertaId, destinatario, desde, hasta, pagina, limite }) {
  const where = {};
  if (estado) where.estado = estado;
  if (alertaId) where.alerta_id = alertaId;
  if (destinatario) where.destinatario = destinatario;
  if (desde || hasta) {
    where.fecha_creacion = {
      ...(desde ? { [Op.gte]: desde } : {}),
      ...(hasta ? { [Op.lte]: hasta } : {}),
    };
  }
  const { rows, count } = await NotificacionCorreo.findAndCountAll({
    where,
    include: [{
      model: Alerta,
      as: 'alerta',
      attributes: ['id', 'tipo', 'severidad', 'producto_id', 'lote_id', 'mensaje'],
    }],
    order: [['fecha_creacion', 'DESC'], ['id', 'DESC']],
    limit: limite,
    offset: (pagina - 1) * limite,
  });
  return { filas: rows.map((fila) => new NotificacionCorreoDto(fila.get({ plain: true }))), total: count };
}

module.exports = {
  rolesConfigurados,
  usuariosActivosPorRol,
  listarRoles,
  listarConfiguracion,
  guardarConfiguracion,
  buscarRegistro,
  crearRegistro,
  actualizarRegistro,
  pendientesDeReintento,
  reservarRegistro,
  buscarAlerta,
  contextoAlerta,
  historial,
};
