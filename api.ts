import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'

export interface Kpis {
  productos_activos: number
  ventas_mes_actual: number
  alertas_activas: number
  alertas_criticas: number
  ordenes_pendientes: number
}

export interface ResumenInicio {
  alertas_recientes: Array<{
    id: number
    tipo: string
    severidad: string
    mensaje: string
    estado: string
    fecha_creacion: string
  }>
  kpis: Kpis
}

export function useKpis() {
  return useQuery({
    queryKey: ['reportes', 'kpis'],
    queryFn: async () => {
      const respuesta = await api.get<{ data: Kpis }>('/reportes/kpis')
      return respuesta.data
    },
  })
}

export function useResumenInicio() {
  return useQuery({
    queryKey: ['reportes', 'inicio'],
    queryFn: async () => {
      const respuesta = await api.get<{ data: ResumenInicio }>('/reportes/inicio')
      return respuesta.data
    },
  })
}
