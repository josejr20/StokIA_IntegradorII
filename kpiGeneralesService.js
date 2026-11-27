'use strict';

const calculo = require('./kpiGeneralesCalculo');

const METODOLOGIA = {
  rotacion: 'Costo de ventas del periodo ÷ inventario promedio (saldos al inicio, cierre de cada mes y fin del periodo), según el kardex valorizado.',
  mermas_evitadas: 'Unidades vendidas de lotes con alerta de vencimiento atendida, desde la alerta hasta el vencimiento y sin superar las unidades en riesgo. Es una estimación conservadora, valorizada a costo.',
};

/**
 * Orquesta la consulta de KPIs generales (US-34) para un periodo.
 * @param {object} filtros  { periodo, desde, hasta }
 * @param {object} deps     { repositorio, ahora } inyectables para pruebas
 */
async function obtenerKpisGenerales(filtros = {}, deps = {}) {
  const ahora = deps.ahora ?? new Date();
  const periodo = calculo.resolverPeriodo(filtros, ahora);
  const repo = deps.repositorio ?? require('./kpiGeneralesRepositorio').crearRepositorioSequelize();

  const finExclusivo = calculo.sumarDias(periodo.hasta, 1);
  const cortes = calculo.puntosDeMuestreo(periodo);

  const [primerDato, diasConVentas, ventas, snapshots, alertas] = await Promise.all([
    repo.primerDato(),
    repo.diasConVentas({ desde: periodo.desde, finExclusivo }),
    repo.ventasNetas({ desde: periodo.desde, finExclusivo }),
    Promise.all(cortes.map((corte) => repo.inventarioAl(corte))),
    repo.alertasAtendidas({ desde: periodo.desde, finExclusivo }),
  ]);

  // HU-174
  const rotacion = calculo.calcularRotacion({
    costoVentas: ventas.costo,
    unidadesVendidas: ventas.unidades,
    snapshots,
    dias: periodo.dias,
  });

  const suficiencia = calculo.evaluarSuficiencia({ periodo, primerDato, diasConVentas, rotacion });

  // HU-175
  const ids = [...new Set(alertas.map((a) => Number(a.lote_id)))];
  const [lotesFilas, salidas] = await Promise.all([
    repo.lotes(ids),
    ids.length
      ? repo.salidasPorVenta(ids, new Date(Math.min(...alertas.map((a) => new Date(a.fecha_creacion).getTime()))).toISOString())
      : [],
  ]);
  const lotes = new Map(lotesFilas.map((l) => [Number(l.id), l]));
  const mermas = calculo.calcularMermasEvitadas({ alertas, lotes, salidas });

  const calculable = suficiencia.historialOk;
  return {
    periodo,
    suficiente: suficiencia.suficiente,
    mensaje: suficiencia.suficiente
      ? null
      : 'No es posible calcular los indicadores del periodo: no hay datos históricos suficientes.',
    razones: suficiencia.razones,
    rotacion: { ...rotacion, calculable: suficiencia.suficiente && rotacion.calculable },
    mermas_evitadas: { ...mermas, calculable },
    metodologia: METODOLOGIA,
    generado_en: ahora.toISOString(),
  };
}

module.exports = { METODOLOGIA, obtenerKpisGenerales };
