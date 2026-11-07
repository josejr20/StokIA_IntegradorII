// HU-128 (US-25) · Helpers de presentación (puros, con pruebas en formato.test.ts).

import type { TotalPeriodo } from './api'

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** '2026-09-08' -> '8 sep' (sin pasar por Date para no sufrir corrimientos de zona horaria). */
export function fechaCorta(iso: string) {
  const [, mes, dia] = iso.split('-').map(Number)
  return `${dia} ${MESES[mes - 1]}`
}

export function etiquetaPeriodo(inicio: string, fin: string) {
  return inicio === fin ? fechaCorta(inicio) : `${fechaCorta(inicio)} – ${fechaCorta(fin)}`
}

/** '+12,5 %' / '-8 %' / '—' (TC-04: la diferencia porcentual siempre con signo). */
export function textoPorcentaje(valor: number | null) {
  if (valor === null) return '—'
  const texto = Math.abs(valor).toLocaleString('es-PE', { maximumFractionDigits: 1 })
  if (valor > 0) return `+${texto} %`
  if (valor < 0) return `-${texto} %`
  return `${texto} %`
}

export function textoNumero(valor: number | null) {
  return valor === null ? '—' : valor.toLocaleString('es-PE', { maximumFractionDigits: 2 })
}

/** Lectura de la diferencia: positivo = el modelo predijo de más. */
export function lecturaDiferencia(pct: number | null) {
  if (pct === null) return 'Sin dato'
  if (Math.abs(pct) <= 10) return 'Muy cercana'
  return pct > 0 ? 'Sobreestimó' : 'Subestimó'
}

export interface PuntoGrafico {
  etiqueta: string
  prediccion: number | null
  venta_real: number | null
  diferencia_pct: number | null
  sinDatos: boolean
}

/** TC-05: puntos para la gráfica. Los periodos sin datos quedan con huecos (null), no con ceros. */
export function datosGrafico(periodos: TotalPeriodo[]): PuntoGrafico[] {
  return periodos.map((periodo) => ({
    etiqueta: etiquetaPeriodo(periodo.periodo_inicio, periodo.periodo_fin),
    prediccion: periodo.estado === 'ok' ? periodo.prediccion : null,
    venta_real: periodo.estado === 'ok' ? periodo.venta_real : null,
    diferencia_pct: periodo.diferencia_pct,
    sinDatos: periodo.estado !== 'ok',
  }))
}
