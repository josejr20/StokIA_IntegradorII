'use strict';

/**
 * US-32 — Reglas puras (sin base de datos ni SMTP) de la notificación de alertas críticas.
 * Se mantienen aparte para poder probarlas de forma aislada.
 */

/** Tipos de alerta que se notifican por correo: vencimiento y quiebre de stock. */
const TIPOS_NOTIFICABLES = ['riesgo_vencimiento', 'bajo_stock'];

/**
 * Severidades que el sistema considera críticas.
 *  - 'critica': lote ya vencido (umbralVencimientoService).
 *  - 'alta'   : nivel máximo de riesgo del resto de generadores — lote con riesgo alto de vencimiento
 *               o producto sin stock (quiebre).
 * Las alertas de severidad 'media' o 'baja' no generan correo.
 */
const SEVERIDADES_CRITICAS = ['critica', 'alta'];

/** Roles que reciben las alertas cuando todavía no hay ninguna configuración guardada para el tipo. */
const ROLES_POR_DEFECTO = ['Encargado de Almacén'];

const ESTADOS_ABIERTOS = ['nueva', 'vista'];
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ETIQUETA_TIPO = {
  riesgo_vencimiento: 'Riesgo de vencimiento',
  bajo_stock: 'Quiebre de stock',
};

const ETIQUETA_NIVEL = { critica: 'CRÍTICO', alta: 'ALTO' };
const COLOR_NIVEL = { critica: '#991b1b', alta: '#dc2626' };

/** TC-01/TC-03: una alerta es crítica si es de un tipo notificable y de severidad crítica/alta. */
function esAlertaCritica(alerta) {
  return Boolean(alerta)
    && TIPOS_NOTIFICABLES.includes(alerta.tipo)
    && SEVERIDADES_CRITICAS.includes(alerta.severidad);
}

function esAlertaAbierta(alerta) {
  return Boolean(alerta) && ESTADOS_ABIERTOS.includes(alerta.estado ?? 'nueva');
}

function normalizarEmail(valor) {
  const email = String(valor ?? '').trim().toLowerCase();
  return REGEX_EMAIL.test(email) ? email : null;
}

function escaparHtml(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

function formatoNumero(valor) {
  const numero = Number(valor);
  return valor !== null && valor !== undefined && valor !== '' && Number.isFinite(numero)
    ? numero.toLocaleString('es-PE', { maximumFractionDigits: 2 })
    : null;
}

function formatoFecha(valor) {
  if (!valor) return null;
  const texto = String(valor);
  // 'YYYY-MM-DD' se interpreta como fecha local para no desplazarla un día por la zona horaria.
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(texto) ? new Date(`${texto}T00:00:00`) : new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha.toLocaleDateString('es-PE');
}

/** Nombre legible del producto: «P-004 · Nombre», o lo que haya disponible. */
function describirProducto(alerta, contexto = {}) {
  const datos = alerta.datos_origen ?? {};
  const codigo = contexto.producto?.codigo ?? datos.codigo ?? null;
  const nombre = contexto.producto?.nombre ?? datos.nombre ?? null;
  if (codigo && nombre) return `${codigo} · ${nombre}`;
  return nombre ?? codigo ?? `Producto #${alerta.producto_id}`;
}

/**
 * TC-04: motivo de la alerta, en una frase. Para stock cero explica el quiebre;
 * en los demás casos usa el mensaje con el que se registró la alerta.
 */
function describirMotivo(alerta, contexto = {}) {
  const datos = alerta.datos_origen ?? {};
  if (alerta.tipo === 'bajo_stock') {
    const disponible = formatoNumero(datos.stock_disponible);
    const minimo = formatoNumero(datos.stock_minimo);
    if (Number(datos.stock_disponible) === 0) {
      return `Quiebre de stock: no quedan unidades disponibles${minimo ? ` (mínimo configurado: ${minimo})` : ''}.`;
    }
    if (disponible && minimo) return `Stock bajo: quedan ${disponible} unidades y el mínimo es ${minimo}.`;
  }
  return String(alerta.mensaje ?? '').trim() || ETIQUETA_TIPO[alerta.tipo] || 'Alerta crítica';
}

/**
 * TC-04: arma el correo con producto, motivo y nivel de riesgo.
 * `contexto` = { producto?: {codigo, nombre}, lote?: {numero_lote, fecha_vencimiento, cantidad_actual} }
 * trae los datos que la alerta no guardó en `datos_origen` (p. ej. las de umbral de vencimiento).
 */
function construirCorreoCritico(alerta, contexto = {}) {
  const datos = alerta.datos_origen ?? {};
  const producto = describirProducto(alerta, contexto);
  const motivo = describirMotivo(alerta, contexto);
  const etiquetaNivel = ETIQUETA_NIVEL[alerta.severidad] ?? String(alerta.severidad ?? '').toUpperCase();
  const color = COLOR_NIVEL[alerta.severidad] ?? COLOR_NIVEL.alta;
  const tipo = ETIQUETA_TIPO[alerta.tipo] ?? 'Alerta';

  const numeroLote = contexto.lote?.numero_lote ?? datos.numero_lote ?? null;
  const vencimiento = formatoFecha(contexto.lote?.fecha_vencimiento ?? datos.fecha_vencimiento);
  const filas = [
    ['Tipo de alerta', tipo],
    ['Producto', producto],
    numeroLote ? ['Lote', numeroLote] : null,
    vencimiento ? ['Fecha de vencimiento', vencimiento] : null,
    ['Motivo', motivo],
    ['Nivel de riesgo', etiquetaNivel],
    ['Fecha de la alerta', new Date(alerta.fecha_creacion ?? Date.now()).toLocaleString('es-PE')],
  ].filter(Boolean);

  const tabla = filas.map(([etiqueta, valor]) => `<tr>
      <td style="padding:8px;border:1px solid #eee;background:#f9f9f9;width:35%"><strong>${escaparHtml(etiqueta)}</strong></td>
      <td style="padding:8px;border:1px solid #eee">${escaparHtml(valor)}</td>
    </tr>`).join('');

  return {
    asunto: `[${etiquetaNivel}] ${tipo}: ${producto}${numeroLote ? ` - lote ${numeroLote}` : ''}`.slice(0, 300),
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #ddd;border-radius:8px;overflow:hidden">
    <div style="background:${color};color:white;padding:16px 20px"><h2 style="margin:0;font-size:18px">Alerta crítica: ${escaparHtml(tipo)}</h2></div>
    <div style="padding:20px">
      <table style="width:100%;border-collapse:collapse">${tabla}</table>
      <p style="color:#991b1b"><strong>Acción requerida:</strong> revise esta alerta en StockIA y tome las medidas necesarias.</p>
    </div>
    <div style="background:#f9f9f9;padding:12px 20px;font-size:12px;color:#666;text-align:center">StockIA - Sistema de Gestión de Inventario</div>
  </div>`,
  };
}

/**
 * TC-07: espera antes del siguiente reintento, con crecimiento exponencial.
 * `intentos` = envíos ya realizados (>= 1). Con base 5 min: 5, 10, 20, 40, 60 (tope 60).
 */
function calcularMinutosReintento(intentos, baseMinutos = 5, topeMinutos = 60) {
  const exponente = Math.max(0, Number(intentos) - 1);
  return Math.min(baseMinutos * (2 ** exponente), topeMinutos);
}

/** Texto corto y seguro del error para guardarlo en el historial (sin credenciales). */
function resumirError(error) {
  const texto = String(error?.message ?? error ?? 'Error desconocido').replace(/\s+/g, ' ').trim();
  return texto.slice(0, 500) || 'Error desconocido';
}

module.exports = {
  TIPOS_NOTIFICABLES,
  SEVERIDADES_CRITICAS,
  ROLES_POR_DEFECTO,
  ESTADOS_ABIERTOS,
  esAlertaCritica,
  esAlertaAbierta,
  normalizarEmail,
  construirCorreoCritico,
  describirMotivo,
  calcularMinutosReintento,
  resumirError,
};
