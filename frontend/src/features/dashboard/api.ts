import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'

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

export const CLAVE_PREFERENCIA_DASHBOARD = 'dashboard_kpis'

export interface ValorPreferenciaDashboard {
  indicadores: (keyof Kpis)[]
}

export interface PreferenciaDashboard {
  id: number
  usuario_id: number
  clave: string
  valor: ValorPreferenciaDashboard
  fecha_actualizacion: string
}

interface RespuestaPreferencias {
  data: PreferenciaDashboard[]
}

interface RespuestaPreferencia {
  message?: string
  data: PreferenciaDashboard
}

interface RespuestaOperacion {
  message: string
}

export function useKpis() {
  return useQuery({
    queryKey: ['reportes', 'kpis'],
    queryFn: async () => {
      const respuesta = await api.get<{ data: Kpis }>(
        '/reportes/kpis'
      )

      return respuesta.data
    },
  })
}

export function useResumenInicio() {
  return useQuery({
    queryKey: ['reportes', 'inicio'],
    queryFn: async () => {
      const respuesta = await api.get<{ data: ResumenInicio }>(
        '/reportes/inicio'
      )

      return respuesta.data
    },
  })
}

export async function obtenerPreferenciasDashboard() {
  const respuesta = await api.get<RespuestaPreferencias>(
    '/preferencias'
  )

  return respuesta.data.find(
    (preferencia) =>
      preferencia.clave === CLAVE_PREFERENCIA_DASHBOARD
  )
}

export function usePreferenciasDashboard(usuarioId?: number) {
  return useQuery({
    queryKey: ['preferencias-dashboard', usuarioId],
    enabled: Boolean(usuarioId),

    queryFn: obtenerPreferenciasDashboard,
  })
}

export async function guardarPreferenciasDashboard(
  indicadores: (keyof Kpis)[]
) {
  const respuesta = await api.post<RespuestaPreferencia>(
    '/preferencias',
    {
      clave: CLAVE_PREFERENCIA_DASHBOARD,
      valor: {
        indicadores,
      },
    }
  )

  return respuesta.data
}

export function useGuardarPreferenciasDashboard() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: guardarPreferenciasDashboard,

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['preferencias-dashboard'],
      })
    },
  })
}

export async function restablecerPreferenciasDashboard() {
  const respuesta = await api.del<RespuestaOperacion>(
    `/preferencias/${CLAVE_PREFERENCIA_DASHBOARD}`
  )

  return respuesta
}

export function useRestablecerPreferenciasDashboard() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: restablecerPreferenciasDashboard,

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['preferencias-dashboard'],
      })
    },
  })
}