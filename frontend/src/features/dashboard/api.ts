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

export interface PreferenciasDashboard {
  indicadores: Record<keyof Kpis, boolean>
}

export interface PreferenciaUsuario {
  id: number
  usuario_id: number
  clave: string
  valor: PreferenciasDashboard
  fecha_actualizacion: string
}

export const CLAVE_PREFERENCIAS_DASHBOARD = 'dashboard_preferencias'

export const PREFERENCIAS_POR_DEFECTO: PreferenciasDashboard = {
  indicadores: {
    productos_activos: true,
    ventas_mes_actual: true,
    alertas_activas: true,
    alertas_criticas: true,
    ordenes_pendientes: true,
  },
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

export function usePreferenciasDashboard() {
  return useQuery({
    queryKey: ['preferencias', 'dashboard'],
    queryFn: async () => {
      const respuesta = await api.get<{ data: PreferenciaUsuario[] }>('/preferencias')

      const preferencia = respuesta.data.find(
        (item) => item.clave === CLAVE_PREFERENCIAS_DASHBOARD,
      )

      return preferencia?.valor ?? PREFERENCIAS_POR_DEFECTO
    },
  })
}

export async function guardarPreferenciasDashboard(
  preferencias: PreferenciasDashboard,
) {
  return api.post('/preferencias', {
    clave: CLAVE_PREFERENCIAS_DASHBOARD,
    valor: preferencias,
  })
}
