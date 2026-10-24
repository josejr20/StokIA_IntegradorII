'use strict';

/**
 * HU-98 · BE-01 y BE-02 — Cálculo y clasificación del riesgo de vencimiento.
 *
 * Módulo puro (sin base de datos): recibe los lotes con stock de UN producto y su demanda
 * estimada (HU-72) y devuelve el nivel de riesgo de cada lote.
 *
 * Idea: un lote está en riesgo si, al ritmo de venta estimado, no se alcanza a vender antes
 * de su fecha de vencimiento. Cuando un producto tiene varios lotes se vende primero el que
 * vence antes (FEFO), así que cada lote solo cuenta con la demanda que sobra después de
 * abastecer a los que vencen antes.
 *
 *   demanda hasta el vencimiento  = demanda estimada de hoy hasta el día anterior al vencimiento
 *   unidades que se venderían     = min(stock, demanda disponible para ese lote)
 *   unidades en riesgo            = stock - unidades que se venderían
 *   porcentaje en riesgo          = unidades en riesgo / stock
 */

const CONFIG = Object.freeze({
  UMBRAL_ALTO: 0.5, // riesgo alto: se estima que >= 50 % del lote no se vende a tiempo
  UMBRAL_MEDIO: 0.15, // riesgo medio: >= 15 %; por debajo, riesgo bajo
  DIAS_URGENTE: 7, // un riesgo medio sube a alto si faltan 7 días o menos para vencer
  HORIZONTE_MAX_DIAS: 180, // hasta dónde se proyecta la demanda
});

const MS_DIA = 24 * 60 * 60 * 1000;
const ORDEN_NIVEL = Object.freeze({ alto: 0, medio: 1, bajo: 2, datos_insuficientes: 3 });

const redondear = (valor, decimales = 2) => {
  const factor = 10 ** decimales;
  return Math.round((valor + Number.EPSILON) * factor) / factor;
};
const numero = (valor) => valor.toLocaleString('es-PE', { maximumFractionDigits: 1 });
const plural = (n, singular, pluralTexto) => (n === 1 ? singular : pluralTexto);

const aUtc = (iso) => {
  const [anio, mes, dia] = iso.split('-').map(Number);
  return Date.UTC(anio, mes - 1, dia);
};
const diasEntre = (isoA, isoB) => Math.round((aUtc(isoB) - aUtc(isoA)) / MS_DIA);
const fechaLarga = (iso) => iso.split('-').reverse().join('/');

/** Date | 'YYYY-MM-DD' | null -> 'YYYY-MM-DD' | null (las fechas DATE se leen en hora local). */
function aIso(valor) {
  if (!valor) return null;
  if (typeof valor === 'string') return /^\d{4}-\d{2}-\d{2}/.test(valor) ? valor.slice(0, 10) : null;
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    const dos = (n) => String(n).padStart(2, '0');
    return `${valor.getFullYear()}-${dos(valor.getMonth() + 1)}-${dos(valor.getDate())}`;
  }
  return null;
}

/** Demanda estimada desde hoy hasta el día ANTERIOR al vencimiento (ese día ya no se vende). */
function demandaHastaVencimiento(demanda, vencimiento) {
  let total = 0;
  for (const dia of demanda.proyeccion) {
    if (dia.fecha >= vencimiento) return total;
    total += dia.cantidad;
  }
  // El vencimiento queda más allá de lo proyectado: se completa con el promedio diario.
  const ultimo = demanda.proyeccion[demanda.proyeccion.length - 1];
  if (ultimo) {
    const diasFaltantes = diasEntre(ultimo.fecha, vencimiento) - 1;
    if (diasFaltantes > 0) total += diasFaltantes * (demanda.promedio_diario ?? 0);
  }
  return total;
}

/** BE-02: clasifica el riesgo en alto, medio o bajo. */
function clasificarNivel(porcentajeEnRiesgo, diasParaVencer) {
  let nivel = 'bajo';
  if (porcentajeEnRiesgo >= CONFIG.UMBRAL_ALTO) nivel = 'alto';
  else if (porcentajeEnRiesgo >= CONFIG.UMBRAL_MEDIO) nivel = 'medio';
  if (nivel === 'medio' && diasParaVencer <= CONFIG.DIAS_URGENTE) nivel = 'alto';
  return nivel;
}

const baseLote = (lote, stock, vencimiento, dias) => ({
  lote_id: lote.id,
  numero_lote: lote.numero_lote,
  stock: redondear(stock),
  fecha_vencimiento: vencimiento,
  dias_para_vencer: dias,
});

function textoVencimiento(vencimiento, dias) {
  if (dias < 0) return `Venció el ${fechaLarga(vencimiento)} (hace ${-dias} ${plural(-dias, 'día', 'días')})`;
  if (dias === 0) return `Vence hoy (${fechaLarga(vencimiento)})`;
  return `Vence el ${fechaLarga(vencimiento)} (en ${dias} ${plural(dias, 'día', 'días')})`;
}

function sinDatos(lote, stock, vencimiento, dias, motivo, mensaje, factores) {
  return {
    ...baseLote(lote, stock, vencimiento, dias),
    estado: 'datos_insuficientes',
    nivel: null,
    motivo,
    vencido: false,
    puntaje_riesgo: null,
    unidades_en_riesgo: null,
    porcentaje_en_riesgo: null,
    demanda_hasta_vencimiento: null,
    cobertura_dias: null,
    factores,
    mensaje: `No hay datos suficientes para calcular el riesgo: ${mensaje}`,
  };
}

/**
 * Evalúa todos los lotes con stock de un producto.
 * lotes: [{ id, numero_lote, cantidad_actual, fecha_vencimiento }]
 * demanda: resultado de predecirDemanda (HU-72) o null si no hizo falta calcularlo.
 * hoy: 'YYYY-MM-DD' (hora de Lima).
 */
function evaluarLotes(lotes, demanda, hoy) {
  const resultados = new Map();
  const evaluables = [];

  for (const lote of lotes) {
    const stock = Number(lote.cantidad_actual);
    if (!(stock > 0)) continue; // un lote agotado no corre riesgo
    const vencimiento = aIso(lote.fecha_vencimiento);

    if (!vencimiento) {
      resultados.set(lote.id, sinDatos(
        lote, stock, null, null, 'sin_fecha_vencimiento',
        'el lote no tiene fecha de vencimiento registrada.',
        [`Stock disponible: ${numero(stock)} unidades`, 'El lote no tiene fecha de vencimiento'],
      ));
      continue;
    }

    const dias = diasEntre(hoy, vencimiento);
    if (dias <= 0) {
      // Ya venció (o vence hoy) con stock: es riesgo alto sin necesidad de estimar demanda.
      resultados.set(lote.id, {
        ...baseLote(lote, stock, vencimiento, dias),
        estado: 'ok',
        nivel: 'alto',
        motivo: null,
        vencido: true,
        puntaje_riesgo: 1,
        unidades_en_riesgo: redondear(stock),
        porcentaje_en_riesgo: 100,
        demanda_hasta_vencimiento: 0,
        cobertura_dias: null,
        factores: [`Stock disponible: ${numero(stock)} unidades`, textoVencimiento(vencimiento, dias),
          'Ya no hay tiempo para vender estas unidades'],
        mensaje: dias === 0
          ? 'Riesgo alto: el lote vence hoy y aún tiene stock.'
          : `Riesgo alto: el lote ya venció y aún tiene ${numero(stock)} unidades en stock.`,
      });
      continue;
    }
    evaluables.push({ lote, stock, vencimiento, dias });
  }

  if (!demanda || demanda.estado !== 'ok') {
    for (const { lote, stock, vencimiento, dias } of evaluables) {
      resultados.set(lote.id, sinDatos(
        lote, stock, vencimiento, dias, 'sin_demanda_estimada',
        'no hay historial de ventas suficiente para estimar la demanda de este producto.',
        [`Stock disponible: ${numero(stock)} unidades`, textoVencimiento(vencimiento, dias),
          'No se pudo estimar la demanda (poco historial de ventas)'],
      ));
    }
  } else {
    // BE-01: FEFO — el lote que vence antes se abastece primero.
    evaluables.sort((a, b) => a.vencimiento.localeCompare(b.vencimiento) || a.lote.id - b.lote.id);
    let vendidoEnLotesAnteriores = 0;
    for (const { lote, stock, vencimiento, dias } of evaluables) {
      const demandaTotal = demandaHastaVencimiento(demanda, vencimiento);
      const disponibleParaElLote = Math.max(0, demandaTotal - vendidoEnLotesAnteriores);
      const seVende = Math.min(stock, disponibleParaElLote);
      const previo = vendidoEnLotesAnteriores;
      vendidoEnLotesAnteriores += seVende;

      const enRiesgo = stock - seVende;
      const porcentaje = enRiesgo / stock;
      const nivel = clasificarNivel(porcentaje, dias);
      const promedio = demanda.promedio_diario ?? null;

      // BE-01 / TC-05: los factores que justifican la clasificación.
      const factores = [
        `Stock disponible: ${numero(stock)} unidades`,
        textoVencimiento(vencimiento, dias),
        `Demanda estimada hasta el vencimiento: ${numero(demandaTotal)} unidades` +
          (previo > 0 ? ` (${numero(previo)} se destinan antes a lotes que vencen primero)` : ''),
        enRiesgo > 0
          ? `Se estima que ${numero(enRiesgo)} unidades (${numero(porcentaje * 100)} %) no se alcanzarían a vender antes de vencer`
          : 'La demanda estimada alcanza para vender todo el lote antes de vencer',
      ];
      if (promedio !== null && promedio > 0) {
        factores.push(`Ritmo de venta estimado: ${numero(promedio)} ${plural(promedio, 'unidad', 'unidades')} por día (el stock alcanzaría para ${numero(stock / promedio)} días)`);
      }
      if (dias <= CONFIG.DIAS_URGENTE) factores.push(`Vencimiento muy cercano: ${dias} ${plural(dias, 'día', 'días')}`);
      if (demanda.confianza) factores.push(`Confianza de la estimación de demanda: ${demanda.confianza}`);

      resultados.set(lote.id, {
        ...baseLote(lote, stock, vencimiento, dias),
        estado: 'ok',
        nivel,
        motivo: null,
        vencido: false,
        puntaje_riesgo: redondear(porcentaje, 4),
        unidades_en_riesgo: redondear(enRiesgo),
        porcentaje_en_riesgo: redondear(porcentaje * 100, 1),
        demanda_hasta_vencimiento: redondear(demandaTotal),
        cobertura_dias: promedio && promedio > 0 ? redondear(stock / promedio, 1) : null,
        factores,
        mensaje: enRiesgo > 0
          ? `Riesgo ${nivel}: se estima que ${numero(enRiesgo)} de ${numero(stock)} unidades no se venderán antes del ${fechaLarga(vencimiento)}.`
          : `Riesgo ${nivel}: la demanda estimada alcanza para vender el lote antes del ${fechaLarga(vencimiento)}.`,
      });
    }
  }

  // Se devuelven en el orden de vencimiento (los que no tienen fecha, al final).
  return [...resultados.values()].sort((a, b) => {
    if (a.fecha_vencimiento === b.fecha_vencimiento) return a.lote_id - b.lote_id;
    if (a.fecha_vencimiento === null) return 1;
    if (b.fecha_vencimiento === null) return -1;
    return a.fecha_vencimiento.localeCompare(b.fecha_vencimiento);
  });
}

/** Nivel del producto = el del peor de sus lotes. */
function consolidarProducto(lotesEvaluados) {
  const conNivel = lotesEvaluados.filter((lote) => lote.estado === 'ok');
  const unidadesEnRiesgo = redondear(conNivel.reduce((suma, lote) => suma + lote.unidades_en_riesgo, 0));
  if (conNivel.length === 0) {
    return { nivel: 'datos_insuficientes', motivo: lotesEvaluados[0]?.motivo ?? null, unidades_en_riesgo: 0 };
  }
  const peor = conNivel.reduce((a, b) => (ORDEN_NIVEL[b.nivel] < ORDEN_NIVEL[a.nivel] ? b : a));
  return { nivel: peor.nivel, motivo: null, unidades_en_riesgo: unidadesEnRiesgo };
}

module.exports = {
  CONFIG,
  ORDEN_NIVEL,
  evaluarLotes,
  consolidarProducto,
  clasificarNivel,
  demandaHastaVencimiento,
  diasEntre,
  aIso,
};
