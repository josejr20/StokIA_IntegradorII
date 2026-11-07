'use strict';

const { Op } = require('sequelize');
const loggerPorDefecto = require('../utils/logger');

const CLAVE_PREFERENCIAS = 'email_alertas_inventario';

function escaparHtml(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, (caracter) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[caracter]);
}

function formatoNumero(valor) {
  const numero = Number(valor);
  return Number.isFinite(numero)
    ? numero.toLocaleString('es-PE', { maximumFractionDigits: 2 })
    : 'No disponible';
}

function plantillaEmail(titulo, color, contenido) {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #ddd;border-radius:8px;overflow:hidden">
    <div style="background:${color};color:white;padding:16px 20px"><h2 style="margin:0;font-size:18px">${titulo}</h2></div>
    <div style="padding:20px">${contenido}</div>
    <div style="background:#f9f9f9;padding:12px 20px;font-size:12px;color:#666;text-align:center">StockIA - Sistema de Gestión de Inventario</div>
  </div>`;
}

function crearContenidoCorreo(alerta) {
  const datos = alerta.datos_origen ?? {};
  const fecha = new Date(alerta.fecha_creacion ?? new Date()).toLocaleString('es-PE');
  if (alerta.tipo === 'bajo_stock') {
    const color = alerta.severidad === 'alta' ? '#dc2626' : '#f59e0b';
    const filas = [
      ['Código', datos.codigo],
      ['Producto', datos.nombre],
      ['Stock disponible', formatoNumero(datos.stock_disponible)],
      ['Stock mínimo', formatoNumero(datos.stock_minimo)],
      ['Faltante', `${formatoNumero(datos.faltante)} unidades`],
      ['Origen del mínimo', datos.origen_umbral],
    ].map(([etiqueta, valor]) => `<tr><td style="padding:8px;border:1px solid #eee;background:#f9f9f9">${escaparHtml(etiqueta)}</td><td style="padding:8px;border:1px solid #eee;text-align:right">${escaparHtml(valor)}</td></tr>`).join('');
    return {
      asunto: `Alerta de stock bajo: ${datos.codigo || alerta.producto_id}`,
      html: plantillaEmail('Alerta de stock bajo', color, `
        <p><strong>Fecha de evaluación:</strong> ${escaparHtml(fecha)}</p>
        <table style="width:100%;border-collapse:collapse">${filas}</table>
        <p style="color:#991b1b"><strong>Acción requerida:</strong> Revisar el reabastecimiento de este producto.</p>`),
    };
  }

  const color = alerta.severidad === 'alta' ? '#dc2626' : '#f59e0b';
  const fechaVencimiento = datos.fecha_vencimiento
    ? new Date(`${datos.fecha_vencimiento}T00:00:00`).toLocaleDateString('es-PE')
    : 'Sin fecha';
  const filas = [
    ['Código', datos.codigo],
    ['Producto', datos.nombre],
    ['Lote', datos.numero_lote],
    ['Fecha de vencimiento', `${fechaVencimiento} (${formatoNumero(datos.dias_para_vencer)} días)`],
    ['Stock disponible', formatoNumero(datos.stock)],
    ['Demanda hasta vencimiento', formatoNumero(datos.demanda_hasta_vencimiento)],
    ['Unidades en riesgo', `${formatoNumero(datos.unidades_en_riesgo)} (${formatoNumero(datos.porcentaje_en_riesgo)}%)`],
    ['Nivel de riesgo', String(alerta.severidad ?? '').toLocaleUpperCase('es-PE')],
  ].map(([etiqueta, valor]) => `<tr><td style="padding:8px;border:1px solid #eee;background:#f9f9f9">${escaparHtml(etiqueta)}</td><td style="padding:8px;border:1px solid #eee;text-align:right">${escaparHtml(valor)}</td></tr>`).join('');
  const factores = Array.isArray(datos.factores)
    ? datos.factores.map((factor) => `<li>${escaparHtml(factor)}</li>`).join('')
    : '';
  return {
    asunto: `Alerta de vencimiento: ${datos.codigo || alerta.producto_id} - lote ${datos.numero_lote || alerta.lote_id}`,
    html: plantillaEmail('Alerta de riesgo de vencimiento', color, `
      <p><strong>Fecha de análisis:</strong> ${escaparHtml(fecha)}</p>
      <table style="width:100%;border-collapse:collapse">${filas}</table>
      <p style="color:#991b1b"><strong>${escaparHtml(datos.mensaje)}</strong></p>
      ${factores ? `<h3>Factores de evaluación</h3><ul>${factores}</ul>` : ''}`),
  };
}

function crearContenidoCorreoStock(alertas) {
  const filas = alertas.map((alerta) => {
    const datos = alerta.datos_origen ?? {};
    return `<tr>
      <td style="padding:8px;border:1px solid #ddd">${escaparHtml(datos.codigo)}</td>
      <td style="padding:8px;border:1px solid #ddd">${escaparHtml(datos.nombre)}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:right">${formatoNumero(datos.stock_disponible)}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:right">${formatoNumero(datos.stock_minimo)}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:right">${formatoNumero(datos.faltante)}</td>
      <td style="padding:8px;border:1px solid #ddd">${escaparHtml(datos.origen_umbral)}</td>
    </tr>`;
  }).join('');

  return {
    asunto: `Resumen de stock bajo: ${alertas.length} ${alertas.length === 1 ? 'producto' : 'productos'}`,
    html: plantillaEmail('Resumen de productos con stock bajo', '#dc2626', `
      <p>Se encontraron <strong>${alertas.length}</strong> productos por debajo de su stock mínimo.</p>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead><tr style="background:#f3f4f6">
            <th style="padding:8px;border:1px solid #ddd;text-align:left">Código</th>
            <th style="padding:8px;border:1px solid #ddd;text-align:left">Producto</th>
            <th style="padding:8px;border:1px solid #ddd;text-align:right">Stock disponible</th>
            <th style="padding:8px;border:1px solid #ddd;text-align:right">Stock mínimo</th>
            <th style="padding:8px;border:1px solid #ddd;text-align:right">Faltante</th>
            <th style="padding:8px;border:1px solid #ddd;text-align:left">Origen del mínimo</th>
          </tr></thead>
          <tbody>${filas}</tbody>
        </table>
      </div>`),
  };
}

function crearNotificador({
  PreferenciaUsuario,
  NotificacionCorreo,
  enviarCorreo,
  logger = loggerPorDefecto,
}) {
  return async function notificarAlerta(alerta, usuarioId) {
    if (!usuarioId) {
      return { destinatarios: 0, enviados: 0, fallidos: 0, motivo: 'usuario_no_identificado' };
    }

    const preferencia = await PreferenciaUsuario.findOne({
      where: { usuario_id: usuarioId, clave: CLAVE_PREFERENCIAS },
    });
    const campo = alerta.tipo === 'bajo_stock' ? 'bajo_stock' : 'riesgo_vencimiento';
    const email = String(preferencia?.valor?.email ?? '').trim().toLowerCase();
    if (
      preferencia?.valor?.activo !== true
      || preferencia.valor[campo] !== true
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return { destinatarios: 0, enviados: 0, fallidos: 0, motivo: 'preferencia_no_activa' };
    }

    const correo = crearContenidoCorreo(alerta);
    let registro = await NotificacionCorreo.findOne({
      where: { alerta_id: alerta.id, destinatario: email },
    });
    if (registro?.estado === 'enviado') {
      return { destinatarios: 1, enviados: 0, fallidos: 0, motivo: 'ya_enviado' };
    }
    if (!registro) {
      registro = await NotificacionCorreo.create({
        alerta_id: alerta.id,
        destinatario: email,
        estado: 'pendiente',
        proveedor: 'smtp',
      });
    } else {
      await registro.update({ estado: 'pendiente' });
    }

    try {
      await enviarCorreo(email, correo.asunto, correo.html);
      await registro.update({ estado: 'enviado', fecha_envio: new Date(), proveedor: 'smtp' });
      return { destinatarios: 1, enviados: 1, fallidos: 0, motivo: null };
    } catch (error) {
      await registro.update({ estado: 'fallido', fecha_envio: null });
      logger.error(`No se pudo enviar alerta ${alerta.id} a ${email}: ${error.message}`);
      return { destinatarios: 1, enviados: 0, fallidos: 1, motivo: 'fallo_smtp' };
    }
  };
}

function crearNotificadorStock({
  PreferenciaUsuario,
  NotificacionCorreo,
  enviarCorreo,
  logger = loggerPorDefecto,
}) {
  return async function notificarAlertasStock(alertas, usuarioId) {
    if (!usuarioId) {
      return { destinatarios: 0, enviados: 0, fallidos: 0, motivo: 'usuario_no_identificado' };
    }
    if (!alertas.length) {
      return { destinatarios: 0, enviados: 0, fallidos: 0, motivo: 'sin_alertas' };
    }

    const preferencia = await PreferenciaUsuario.findOne({
      where: { usuario_id: usuarioId, clave: CLAVE_PREFERENCIAS },
    });
    const email = String(preferencia?.valor?.email ?? '').trim().toLowerCase();
    if (
      preferencia?.valor?.activo !== true
      || preferencia.valor.bajo_stock !== true
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return { destinatarios: 0, enviados: 0, fallidos: 0, motivo: 'preferencia_no_activa' };
    }

    const registrosPendientes = [];
    for (const alerta of alertas) {
      let registro = await NotificacionCorreo.findOne({
        where: { alerta_id: alerta.id, destinatario: email },
      });
      if (registro?.estado === 'enviado') continue;
      if (!registro) {
        registro = await NotificacionCorreo.create({
          alerta_id: alerta.id,
          destinatario: email,
          estado: 'pendiente',
          proveedor: 'smtp',
        });
      } else {
        await registro.update({ estado: 'pendiente' });
      }
      registrosPendientes.push({ registro, alerta });
    }

    if (!registrosPendientes.length) {
      return { destinatarios: 1, enviados: 0, fallidos: 0, motivo: 'ya_enviado' };
    }

    const correo = crearContenidoCorreoStock(alertas);
    try {
      await enviarCorreo(email, correo.asunto, correo.html);
    } catch (error) {
      await Promise.all(registrosPendientes.map(({ registro }) => (
        registro.update({ estado: 'fallido', fecha_envio: null })
      )));
      logger.error(`No se pudo enviar resumen de stock bajo a ${email}: ${error.message}`);
      return { destinatarios: 1, enviados: 0, fallidos: 1, motivo: 'fallo_smtp' };
    }

    await Promise.all(registrosPendientes.map(({ registro }) => (
      registro.update({ estado: 'enviado', fecha_envio: new Date(), proveedor: 'smtp' })
    )));
    return { destinatarios: 1, enviados: 1, fallidos: 0, motivo: null };
  };
}

async function sincronizarAlertasRiesgo(productos, {
  alcanceProductoIds = null,
  Alerta,
  PreferenciaUsuario,
  NotificacionCorreo,
  notificarAlerta,
  usuarioId,
  logger = loggerPorDefecto,
} = {}) {
  const { Alerta: ModeloAlerta } = require('../models');
  const modelo = Alerta ?? ModeloAlerta;
  const modelos = require('../models');
  const notificar = notificarAlerta ?? crearNotificador({
    PreferenciaUsuario: PreferenciaUsuario ?? modelos.PreferenciaUsuario,
    NotificacionCorreo: NotificacionCorreo ?? modelos.NotificacionCorreo,
    enviarCorreo: require('./correoService').enviarCorreo,
    logger,
  });
  const ids = [...new Set((productos ?? []).map((producto) => Number(producto.producto_id)))];
  const scope = alcanceProductoIds;
  const where = {
    tipo: 'riesgo_vencimiento',
    estado: { [Op.in]: ['nueva', 'vista'] },
    ...(scope ? { producto_id: { [Op.in]: scope } } : {}),
  };
  const alertas = await modelo.findAll({ where });
  const activasPorLote = new Map();
  for (const alerta of alertas) {
    if (alerta.datos_origen?.origen !== 'riesgo_vencimiento') continue;
    activasPorLote.set(Number(alerta.lote_id), alerta);
  }

  const lotesActuales = new Map();
  for (const producto of productos ?? []) {
    for (const lote of producto.lotes ?? []) {
      lotesActuales.set(Number(lote.lote_id), { producto, lote });
    }
  }

  for (const [loteId, alerta] of activasPorLote) {
    const actual = lotesActuales.get(loteId);
    if (!actual || actual.lote.estado !== 'ok' || !['alto', 'medio'].includes(actual.lote.nivel)) {
      await alerta.update({ estado: 'atendida', fecha_atendida: new Date() });
      continue;
    }

    const severidad = actual.lote.nivel === 'alto' ? 'alta' : 'media';
    if (severidad === 'alta' && alerta.severidad !== 'alta') {
      await alerta.update({ estado: 'atendida', fecha_atendida: new Date() });
      activasPorLote.delete(loteId);
    }
  }

  let creadas = 0;
  for (const [loteId, { producto, lote }] of lotesActuales) {
    if (lote.estado !== 'ok' || !['alto', 'medio'].includes(lote.nivel)) continue;
    const alertaExistente = activasPorLote.get(loteId);
    const severidad = lote.nivel === 'alto' ? 'alta' : 'media';
    const datos_origen = {
      origen: 'riesgo_vencimiento',
      producto_id: producto.producto_id,
      codigo: producto.producto?.codigo ?? null,
      nombre: producto.producto?.nombre ?? null,
      lote_id: lote.lote_id,
      numero_lote: lote.numero_lote,
      fecha_vencimiento: lote.fecha_vencimiento,
      dias_para_vencer: lote.dias_para_vencer,
      stock: lote.stock,
      demanda_hasta_vencimiento: lote.demanda_hasta_vencimiento,
      unidades_en_riesgo: lote.unidades_en_riesgo,
      porcentaje_en_riesgo: lote.porcentaje_en_riesgo,
      factores: lote.factores,
      mensaje: lote.mensaje,
    };
    if (alertaExistente) {
      await alertaExistente.update({ mensaje: lote.mensaje, severidad, datos_origen });
      continue;
    }

    const alerta = await modelo.create({
      tipo: 'riesgo_vencimiento',
      producto_id: producto.producto_id,
      lote_id: lote.lote_id,
      mensaje: lote.mensaje,
      severidad,
      datos_origen,
      estado: 'nueva',
    });
    creadas++;
    try {
      await notificar(alerta, usuarioId);
    } catch (error) {
      logger.error(`No se pudo notificar el riesgo de vencimiento del lote ${loteId}: ${error.message}`);
    }
  }

  return { creadas, evaluadas: lotesActuales.size };
}

async function notificarAlerta(alerta, usuarioId) {
  const { PreferenciaUsuario, NotificacionCorreo } = require('../models');
  const { enviarCorreo } = require('./correoService');
  return crearNotificador({ PreferenciaUsuario, NotificacionCorreo, enviarCorreo })(alerta, usuarioId);
}

async function notificarAlertasStock(alertas, usuarioId) {
  const { PreferenciaUsuario, NotificacionCorreo } = require('../models');
  const { enviarCorreo } = require('./correoService');
  return crearNotificadorStock({ PreferenciaUsuario, NotificacionCorreo, enviarCorreo })(alertas, usuarioId);
}

module.exports = {
  CLAVE_PREFERENCIAS,
  crearContenidoCorreo,
  crearContenidoCorreoStock,
  crearNotificador,
  crearNotificadorStock,
  escaparHtml,
  notificarAlerta,
  notificarAlertasStock,
  sincronizarAlertasRiesgo,
};
