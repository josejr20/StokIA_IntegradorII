import { useMutation } from '@tanstack/react-query'

import { api } from '@/lib/api'

// HU-72: respuesta de GET /api/predicciones/demanda

export type Tendencia = 'sube' | 'baja' | 'estable'
export type Confianza = 'alta' | 'media' | 'baja'

export interface PuntoSerie {
  fecha: string // YYYY-MM-DD
  cantidad: number
}

export interface HistorialPrediccion {
  desde: string | null
  hasta: string | null
  dias_analizados: number
  dias_con_ventas: number
  unidades: number
}

interface PrediccionBase {
  producto_id: number
  producto: { id: number; codigo: string; nombre: string; activo: boolean } | null
  horizonte_dias: number
  mensaje: string
}

export interface PrediccionOk extends PrediccionBase {
  estado: 'ok'
  demanda_estimada: number
  intervalo_inferior: number
  intervalo_superior: number
  nivel_intervalo: number
  promedio_diario: number
  tendencia: Tendencia
  confianza: Confianza
  error_relativo: number | null
  historial: HistorialPrediccion
  serie_historica: PuntoSerie[]
  proyeccion: PuntoSerie[]
  modelo: { nombre: string; version: string }
}

export interface PrediccionInsuficiente extends PrediccionBase {
  estado: 'datos_insuficientes'
  motivo: 'sin_ventas' | 'pocos_dias_con_ventas' | 'historial_corto'
  historial: HistorialPrediccion
  requisitos: { min_dias_con_ventas: number; min_dias_historial: number }
  serie_historica: PuntoSerie[]
}

export interface PrediccionNoEncontrada extends PrediccionBase {
  estado: 'no_encontrado'
}

export type ResultadoPrediccion = PrediccionOk | PrediccionInsuficiente | PrediccionNoEncontrada

export interface RespuestaPrediccion {
  generado_en: string
  horizonte_dias: number
  ultimo_dia_analizado: string
  resultados: ResultadoPrediccion[]
}

export interface ParametrosPrediccion {
  productoIds: number[]
  horizonteDias: number
}

// Se usa useMutation porque la predicción se pide al pulsar el botón, no al abrir la pantalla.
export function usePredecirDemanda() {
  return useMutation({
    mutationFn: async ({ productoIds, horizonteDias }: ParametrosPrediccion) => {
      const params = new URLSearchParams({
        producto_ids: productoIds.join(','),
        horizonte_dias: String(horizonteDias),
      })
      const respuesta = await api.get<{ data: RespuestaPrediccion }>(`/predicciones/demanda?${params.toString()}`)
      return respuesta.data
    },
  })
}
