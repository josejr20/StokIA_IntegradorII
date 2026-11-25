import { useQuery } from '@tanstack/react-query'

import { useAuth } from '@/auth/AuthContext'
import { api } from '@/lib/api'

export interface Kpis {
  productos_activos: number
  ventas_mes_actual: number
  alertas_activas: number
  alertas_criticas: number
  stock_bajo: number
  ordenes_pendientes: number
}

export type IndicadoresInicio = Partial<Record<
  'productos_activos' | 'ventas_mes_actual' | 'alertas_activas' | 'alertas_criticas' | 'stock_bajo' | 'ordenes_pendientes',
  number
>>

export interface AlertaInicio {
  id: number
  tipo: string
  severidad: string
  mensaje: string
  estado: string
  fecha_creacion: string
  producto_id?: number | null
}

export interface PrediccionRelevante {
  producto_id: number
  codigo: string
  nombre: string
  horizonte_dias: number
  demanda_estimada: number
  stock_disponible: number
  faltante: number
  tendencia: string | null
}

// HU-188: el backend solo envía lo que el rol del usuario puede ver.
export interface ResumenInicio {
  generado_en: string
  alertas_recientes: AlertaInicio[]
  predicciones_relevantes: PrediccionRelevante[]
  kpis: IndicadoresInicio
  hay_novedades: boolean
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

// HU-188 TC-06: se pide de nuevo cada vez que se abre el inicio y la caché es propia de cada usuario,
// así un inicio de sesión nunca muestra datos del usuario anterior.
export function useResumenInicio() {
  const { usuario } = useAuth()
  return useQuery({
    queryKey: ['reportes', 'inicio', usuario?.id ?? null],
    enabled: Boolean(usuario),
    staleTime: 0,
    refetchOnMount: 'always',
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