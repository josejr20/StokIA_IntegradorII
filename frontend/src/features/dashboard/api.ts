import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'

export interface Kpis {
  productos_activos: number
  ventas_mes_actual: number
  alertas_activas: number
  alertas_criticas: number
  stock_bajo: number
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

export interface AlertaBajoStock {
  id: number
  mensaje: string
  severidad: string
  estado: string
  fecha_creacion: string
  datos_origen?: {
    codigo?: string
    nombre?: string
    stock_disponible?: number
    stock_minimo?: number
    faltante?: number
  } | null
}

// HU-157: alertas de bajo stock pendientes para mostrarlas en el dashboard.
export function useAlertasBajoStock(habilitado: boolean) {
  return useQuery({
    queryKey: ['alertas', 'bajo-stock'],
    enabled: habilitado,
    refetchInterval: 30000,
    queryFn: async () => {
      const respuesta = await api.get<{ data: AlertaBajoStock[] }>('/alertas?tipo=bajo_stock')
      return respuesta.data.filter((a) => a.estado === 'nueva' || a.estado === 'vista')
    },
  })
}