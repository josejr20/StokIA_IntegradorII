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
    datos_origen?: { nombre?: string }
  }>
  kpis: Kpis
}

export function useKpis(habilitado = true) {
  return useQuery({
    queryKey: ['reportes', 'kpis'],
    enabled: habilitado,
    refetchInterval: 30000,
    queryFn: async () => {
      const respuesta = await api.get<{ data: Kpis }>('/reportes/kpis')
      return respuesta.data
    },
  })
}

export function useResumenInicio(habilitado = true) {
  return useQuery({
    queryKey: ['reportes', 'inicio'],
    enabled: habilitado,
    refetchInterval: 30000,
    queryFn: async () => {
      const respuesta = await api.get<{ data: ResumenInicio }>('/reportes/inicio')
      return respuesta.data
    },
  })
}

export interface AlertaDashboard {
  id: number
  tipo: string
  severidad: string
  mensaje: string
  estado: string
  fecha_creacion: string
  producto_id: number | null
  datos_origen?: { nombre?: string }
}

export function useAlertasDashboard(habilitado = true) {
  return useQuery({
    queryKey: ['dashboard', 'alertas'],
    enabled: habilitado,
    refetchInterval: 30000,
    queryFn: async () => {
      const respuesta = await api.get<{ data: AlertaDashboard[] }>('/alertas')
      return respuesta.data
    },
  })
}

export interface RespuestaAlertasPaginadas {
  data: AlertaDashboard[]
  paginacion: {
    pagina: number
    limite: number
    total: number
    totalPaginas: number
  }
}

export function useAlertasPaginadas(
  pagina: number,
  filtro: string,
  habilitado = true,
) {
  return useQuery({
    queryKey: ['dashboard', 'alertas', 'paginadas', pagina, filtro],
    enabled: habilitado,
    refetchInterval: 30000,
    queryFn: () => {
      const severidad =
        filtro === 'todas' ? '' : `&severidad=${filtro}`

      return api.get<RespuestaAlertasPaginadas>(
        `/alertas?pagina=${pagina}&estado=nueva,vista${severidad}`,
      )
    },
  })
}