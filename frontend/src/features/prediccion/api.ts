import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export type Prioridad = 'alta' | 'media' | 'baja'

export interface Recomendacion {
  producto_id: number
  codigo: string
  nombre: string
  prioridad: Prioridad
  tipo_riesgo: string
  accion: string
  motivo: string
  stock_disponible: number
  stock_vencido: number
  stock_por_vencer_7_dias: number
  fecha_proximo_vencimiento: string | null
  dias_para_vencer: number | null
  ventas_netas_30_dias: number
  demanda_diaria_estimada: number
  demanda_estimada_7_dias: number
  demanda_con_historial: boolean
  metodo_demanda: string
}

export interface RespuestaRecomendaciones {
  generado_en: string
  periodo_dias: number
  data: Recomendacion[]
}

export function useRecomendaciones() {
  return useQuery({
    queryKey: ['recomendaciones', 'us-21'],
    queryFn: () => api.get<RespuestaRecomendaciones>('/recomendaciones'),
  })
}
