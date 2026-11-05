'use strict';

/**
 * HU-114 / US-22: deteccion estadistica inicial de valores atipicos.
 *
 * - Sin base de datos ni efectos secundarios.
 * - Evalua ventas manuales/importadas y movimientos de inventario por producto.
 * - Los movimientos se vinculan a producto mediante lote_id -> lotes.producto_id.
 * - Compara cada registro con los anteriores; un valor detectado como anomalo
 *   NO se incorpora a la referencia de normalidad.
 *
 * IMPORTANTE: todavia NO marca registros en BD, NO envia alertas y NO filtra
 * automaticamente el entrenamiento de la prediccion. Eso corresponde a
 * HU-115/HU-116 y requiere revisar los servicios que escriben en la BD.
 */

const ORIGENES_VENTA_EVALUABLES = new Set(['manual', 'importado']);

const CONFIG_PREDETERMINADA = Object.freeze({
  minimoHistorial: 5,
  maximoHistorial: 30,
  factorMad: 4.5,
  margenRelativo: 0.75,
  margenAbsoluto: 5,
});

function mediana(valores) {
  if (!valores.length) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  const mitad = Math.floor(ordenados.length / 2);
  return ordenados.length % 2
    ? ordenados[mitad]
    : (ordenados[mitad - 1] + ordenados[mitad]) / 2;
}

function interpretarNumero(valor) {
  if (valor === null || valor === undefined || String(valor).trim() === '') return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

function interpretarFecha(valor) {
  const fecha = valor instanceof Date ? valor : new Date(valor);
  return Number.isFinite(fecha.getTime()) ? fecha : null;
}

function validarConfiguracion(config) {
  if (!Number.isInteger(config.minimoHistorial) || config.minimoHistorial < 3) {
    throw new RangeError('minimoHistorial debe ser un entero de al menos 3');
  }
  if (!Number.isInteger(config.maximoHistorial) || config.maximoHistorial < config.minimoHistorial) {
    throw new RangeError('maximoHistorial debe ser >= minimoHistorial');
  }
  for (const clave of ['factorMad', 'margenRelativo', 'margenAbsoluto']) {
    if (!Number.isFinite(config[clave]) || config[clave] < 0) {
      throw new RangeError(`${clave} debe ser un numero no negativo`);
    }
  }
}

function analizarContraHistorial(cantidad, historico, config) {
  const central = mediana(historico);
  const desviaciones = historico.map((valor) => Math.abs(valor - central));
  const mad = mediana(desviaciones);
  // 1.4826 hace la MAD comparable a una desviacion estandar bajo normalidad.
  const tolerancia = Math.max(
    config.factorMad * 1.4826 * mad,
    Math.abs(central) * config.margenRelativo,
    config.margenAbsoluto,
  );
  const limiteInferior = Math.max(0, central - tolerancia);
  const limiteSuperior = central + tolerancia;
  const anomalo = cantidad < limiteInferior || cantidad > limiteSuperior;
  return { anomalo, mediana: central, mad, limite_inferior: limiteInferior, limite_superior: limiteSuperior };
}

/**
 * @param {{ventas?: object[], movimientos?: object[], lotes?: object[]}} datos
 * @param {object} opciones
 * @returns {{anomalias: object[], omitidos: object[], resumen: object}}
 */
function detectarAnomalias({ ventas = [], movimientos = [], lotes = [] } = {}, opciones = {}) {
  const config = { ...CONFIG_PREDETERMINADA, ...opciones };
  validarConfiguracion(config);
  if (![ventas, movimientos, lotes].every(Array.isArray)) {
    throw new TypeError('ventas, movimientos y lotes deben ser arreglos');
  }

  const productoPorLote = new Map(
    lotes.map((lote) => [String(lote.id), lote.producto_id]),
  );
  const entradas = [];
  const omitidos = [];

  function omitir(fuente, registro, motivo) {
    omitidos.push({ fuente, registro_id: registro.id ?? null, motivo });
  }

  function registrar(fuente, registro, { productoId, tipo = null, origen, campoFecha, indice }) {
    const producto = interpretarNumero(productoId);
    const cantidadOriginal = interpretarNumero(registro.cantidad);
    const fecha = interpretarFecha(registro[campoFecha]);
    if (!Number.isInteger(producto) || producto <= 0) {
      return omitir(fuente, registro, 'producto_no_identificado');
    }
    if (registro.id === null || registro.id === undefined || String(registro.id).trim() === '') {
      return omitir(fuente, registro, 'registro_sin_id');
    }
    if (cantidadOriginal === null || cantidadOriginal === 0) {
      return omitir(fuente, registro, 'cantidad_no_valida');
    }
    if (fuente === 'venta' && cantidadOriginal < 0) {
      return omitir(fuente, registro, 'venta_con_cantidad_negativa');
    }
    if (!fecha) return omitir(fuente, registro, 'fecha_no_valida');

    // Un ajuste puede tener signo negativo; comparamos magnitudes y preservamos el original.
    const magnitud = Math.abs(cantidadOriginal);
    // Para movimientos, comparar solo operaciones de la misma clase y origen.
    const grupo = fuente === 'venta'
      ? `venta:${producto}`
      : `movimiento:${producto}:${tipo}:${origen}`;
    entradas.push({
      fuente, registro_id: registro.id, producto_id: producto,
      tipo, origen, cantidad: cantidadOriginal, magnitud,
      fecha: fecha.toISOString(), fechaMs: fecha.getTime(), grupo, indice,
    });
  }

  ventas.forEach((venta, indice) => {
    const origen = venta.origen ?? 'manual';
    if (!ORIGENES_VENTA_EVALUABLES.has(origen)) {
      return omitir('venta', venta, 'origen_no_evaluable');
    }
    registrar('venta', venta, {
      productoId: venta.producto_id,
      origen, campoFecha: 'fecha_venta', indice,
    });
  });

  movimientos.forEach((movimiento, indice) => {
    if (!['ingreso', 'salida', 'ajuste'].includes(movimiento.tipo)) {
      return omitir('movimiento', movimiento, 'tipo_no_evaluable');
    }
    const productoId = movimiento.producto_id ?? productoPorLote.get(String(movimiento.lote_id));
    registrar('movimiento', movimiento, {
      productoId,
      tipo: movimiento.tipo,
      origen: movimiento.origen ?? 'otro',
      campoFecha: 'fecha', indice,
    });
  });

  // Orden temporal para no usar datos futuros al analizar un registro pasado.
  entradas.sort((a, b) => a.fechaMs - b.fechaMs ||
    String(a.registro_id).localeCompare(String(b.registro_id), 'es', { numeric: true }) ||
    a.indice - b.indice);

  const historicos = new Map();
  const anomalias = [];
  let sinHistorial = 0;
  let evaluados = 0;

  for (const registro of entradas) {
    const historial = historicos.get(registro.grupo) ?? [];
    if (historial.length < config.minimoHistorial) {
      sinHistorial += 1;
      historial.push(registro.magnitud);
      historicos.set(registro.grupo, historial);
      continue;
    }

    evaluados += 1;
    const resultado = analizarContraHistorial(registro.magnitud, historial, config);
    if (resultado.anomalo) {
      anomalias.push({
        fuente: registro.fuente,
        registro_id: registro.registro_id,
        producto_id: registro.producto_id,
        tipo: registro.tipo,
        origen: registro.origen,
        cantidad: registro.cantidad,
        fecha: registro.fecha,
        historial_utilizado: historial.length,
        referencia_mediana: resultado.mediana,
        limite_inferior: resultado.limite_inferior,
        limite_superior: resultado.limite_superior,
        motivo: 'cantidad_fuera_de_rango_habitual',
      });
    } else {
      historial.push(registro.magnitud);
      if (historial.length > config.maximoHistorial) historial.shift();
    }
    historicos.set(registro.grupo, historial);
  }

  return {
    anomalias,
    omitidos,
    resumen: {
      registros_validos: entradas.length,
      registros_evaluados: evaluados,
      registros_sin_historial_suficiente: sinHistorial,
      registros_omitidos: omitidos.length,
      anomalias_detectadas: anomalias.length,
    },
  };
}

module.exports = { detectarAnomalias, mediana, CONFIG_PREDETERMINADA };
