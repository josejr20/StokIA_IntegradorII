import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'

// HU-128 (US-25): respuesta de GET /api/predicciones/historico

export type EstadoComparacion = 'ok' | 'sin_datos'
export type MotivoSinDatos = 'sin_ventas_reales' | 'historial_insuficiente' | null

export interface ComparacionPeriodo {
  periodo_inicio: string // YYYY-MM-DD
  periodo_fin: string
  prediccion: number | null
  venta_real: number | null
  /** predicción - venta real: positivo = el modelo sobreestimó. */
  diferencia: number | null
  /** diferencia / venta real × 100 */
  diferencia_pct: number | null
  estado: EstadoComparacion
  mensaje: string | null
}

export interface TotalPeriodo extends ComparacionPeriodo {
  productos_comparados: number
}

export interface DetalleComparacion extends ComparacionPeriodo {
  producto_id: number
  producto_codigo: string
  producto_nombre: string
  motivo: MotivoSinDatos
}

export interface ResumenPrecision {
  comparaciones: number
  sin_datos: number
  error_porcentual_ponderado: number | null
  precision_pct: number | null
  sesgo_pct: number | null
}

export interface RespuestaHistorico {
  generado_en: string
  filtros: { producto_id: number | null; desde: string; hasta: string; periodo_dias: number; hasta_ajustado: boolean }
  hay_datos: boolean
  mensaje: string | null
  productos_truncados: boolean
  max_productos: number
  resumen: ResumenPrecision
  periodos: TotalPeriodo[]
  detalle: DetalleComparacion[]
  modelo: { version: string; nombre: string }
}

export interface FiltrosHistorico {
  productoId: string // '' = todos
  desde: string // '' = por defecto (12 semanas)
  hasta: string // '' = ayer
  periodoDias: number
}

export function parametrosHistorico({ productoId, desde, hasta, periodoDias }: FiltrosHistorico) {
  const params = new URLSearchParams({ periodo_dias: String(periodoDias) })
  if (productoId) params.set('producto_id', productoId)
  if (desde) params.set('desde', desde)
  if (hasta) params.set('hasta', hasta)
  return params.toString()
}

export function useHistoricoPredicciones(filtros: FiltrosHistorico) {
  const qs = parametrosHistorico(filtros)
  return useQuery({
    queryKey: ['hu128-historico-predicciones', qs],
    queryFn: async () => (await api.get<{ data: RespuestaHistorico }>(`/predicciones/historico?${qs}`)).data,
    retry: false,
  })
}
