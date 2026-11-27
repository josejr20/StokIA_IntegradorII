import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'

/** US-34 · GET /api/reportes/kpis/generales */

export type PeriodoKpi = '30d' | '90d' | '180d' | '365d' | 'mes_actual' | 'mes_anterior' | 'personalizado'

export const OPCIONES_PERIODO: Array<{ valor: PeriodoKpi; etiqueta: string }> = [
  { valor: '30d', etiqueta: 'Últimos 30 días' },
  { valor: '90d', etiqueta: 'Últimos 90 días' },
  { valor: '180d', etiqueta: 'Últimos 6 meses' },
  { valor: '365d', etiqueta: 'Último año' },
  { valor: 'mes_actual', etiqueta: 'Mes actual' },
  { valor: 'mes_anterior', etiqueta: 'Mes anterior' },
  { valor: 'personalizado', etiqueta: 'Personalizado' },
]

export interface KpisGenerales {
  periodo: { tipo: PeriodoKpi; desde: string; hasta: string; dias: number }
  /** false cuando no hay datos históricos suficientes (TC-02 / TC-07). */
  suficiente: boolean
  mensaje: string | null
  razones: string[]
  rotacion: {
    calculable: boolean
    valor: number | null
    base: 'valorizado' | 'unidades' | null
    dias_inventario: number | null
    costo_ventas: number
    unidades_vendidas: number
    inventario_promedio_valor: number
    inventario_promedio_unidades: number
  }
  mermas_evitadas: {
    calculable: boolean
    unidades: number
    valor: number
    lotes: number
    alertas: number
  }
  metodologia: { rotacion: string; mermas_evitadas: string }
  generado_en: string
}

export interface FiltroKpis {
  periodo: PeriodoKpi
  desde?: string
  hasta?: string
}

/** Un periodo personalizado solo se consulta con ambas fechas y en orden. */
export function filtroValido({ periodo, desde, hasta }: FiltroKpis) {
  return periodo !== 'personalizado' || (!!desde && !!hasta && desde <= hasta)
}

export function useKpisGenerales(filtro: FiltroKpis) {
  return useQuery({
    queryKey: ['reportes', 'kpis-generales', filtro.periodo, filtro.desde ?? null, filtro.hasta ?? null],
    enabled: filtroValido(filtro),
    placeholderData: keepPreviousData, // evita parpadeos al cambiar de periodo
    queryFn: async () => {
      const parametros = new URLSearchParams({ periodo: filtro.periodo })
      if (filtro.periodo === 'personalizado' && filtro.desde && filtro.hasta) {
        parametros.set('desde', filtro.desde)
        parametros.set('hasta', filtro.hasta)
      }
      const respuesta = await api.get<{ data: KpisGenerales }>(`/reportes/kpis/generales?${parametros}`)
      return respuesta.data
    },
  })
}
