import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'

// HU-98: respuesta de GET /api/riesgo-vencimiento

export type NivelRiesgo = 'alto' | 'medio' | 'bajo'
export type NivelFiltro = NivelRiesgo | 'datos_insuficientes'

export interface LoteRiesgo {
  lote_id: number
  numero_lote: string
  stock: number
  fecha_vencimiento: string | null // YYYY-MM-DD
  dias_para_vencer: number | null
  estado: 'ok' | 'datos_insuficientes'
  nivel: NivelRiesgo | null
  motivo: 'sin_fecha_vencimiento' | 'sin_demanda_estimada' | null
  vencido: boolean
  puntaje_riesgo: number | null
  unidades_en_riesgo: number | null
  porcentaje_en_riesgo: number | null
  demanda_hasta_vencimiento: number | null
  cobertura_dias: number | null
  factores: string[]
  mensaje: string
}

export interface ProductoRiesgo {
  producto_id: number
  producto: { id: number; codigo: string; nombre: string; activo: boolean } | null
  nivel: NivelFiltro
  motivo: string | null
  unidades_en_riesgo: number
  demanda: { estado: string; promedio_diario: number | null; confianza: string | null }
  lotes: LoteRiesgo[]
}

export interface RespuestaRiesgo {
  generado_en: string
  fecha_analisis: string
  criterios: { umbral_alto: number; umbral_medio: number; dias_urgente: number }
  resumen: {
    productos_analizados: number
    lotes_analizados: number
    alto: number
    medio: number
    bajo: number
    datos_insuficientes: number
  }
  productos: ProductoRiesgo[]
}

export function useRiesgoVencimiento() {
  return useQuery({
    queryKey: ['riesgo-vencimiento'],
    queryFn: async () => {
      const respuesta = await api.get<{ data: RespuestaRiesgo }>('/riesgo-vencimiento')
      return respuesta.data
    },
    // HU-98 BE-03: el riesgo debe reflejar siempre el stock, las ventas y los vencimientos actuales,
    // por eso se vuelve a calcular cada vez que se abre la pantalla.
    staleTime: 0,
    refetchOnMount: 'always',
  })
}
