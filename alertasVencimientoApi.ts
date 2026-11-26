import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'

/**
 * US-29 · Alertas de riesgo de vencimiento del dashboard.
 * GET  /api/alertas/vencimiento          -> alertas activas de riesgo alto (ya recalculadas)
 * POST /api/alertas/:id/atender          -> marca una alerta como atendida
 */

export interface AlertaVencimiento {
  id: number
  severidad: 'alta' | 'critica'
  estado: 'nueva' | 'vista'
  producto: { id: number; codigo: string | null; nombre: string | null }
  lote: { id: number | null; numero: string | null }
  /** Motivo de la alerta: explica por qué el lote tiene riesgo alto. */
  motivo: string
  factores: string[]
  fecha_vencimiento: string | null // YYYY-MM-DD
  dias_para_vencer: number | null
  stock: number | null
  unidades_en_riesgo: number | null
  porcentaje_en_riesgo: number | null
  fecha_creacion: string
}

export interface RespuestaAlertasVencimiento {
  alertas: AlertaVencimiento[]
  total: number
  hay_alertas: boolean
  /** false si no se pudo recalcular y se muestra el último estado guardado. */
  sincronizado: boolean
  actualizado_en: string
}

export const CLAVE_ALERTAS_VENCIMIENTO = ['alertas-vencimiento'] as const

export function useAlertasVencimiento(habilitado = true) {
  return useQuery({
    queryKey: CLAVE_ALERTAS_VENCIMIENTO,
    enabled: habilitado,
    queryFn: async () => {
      const respuesta = await api.get<{ data: RespuestaAlertasVencimiento }>('/alertas/vencimiento')
      return respuesta.data
    },
    // El riesgo depende de stock, ventas y fechas: siempre se pide al abrir el dashboard.
    staleTime: 0,
    refetchOnMount: 'always',
    // Red de seguridad por si el WebSocket se cae (TC-06): sondeo cada minuto.
    refetchInterval: 60_000,
  })
}

/** HU-149: marca la alerta como atendida; la tarjeta desaparece al instante y se revierte si falla. */
export function useAtenderAlerta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (alertaId: number) => api.post(`/alertas/${alertaId}/atender`),
    onMutate: async (alertaId) => {
      await queryClient.cancelQueries({ queryKey: CLAVE_ALERTAS_VENCIMIENTO })
      const previo = queryClient.getQueryData<RespuestaAlertasVencimiento>(CLAVE_ALERTAS_VENCIMIENTO)
      if (previo) {
        const alertas = previo.alertas.filter((alerta) => alerta.id !== alertaId)
        queryClient.setQueryData<RespuestaAlertasVencimiento>(CLAVE_ALERTAS_VENCIMIENTO, {
          ...previo,
          alertas,
          total: alertas.length,
          hay_alertas: alertas.length > 0,
        })
      }
      return { previo }
    },
    onError: (_error, _alertaId, contexto) => {
      if (contexto?.previo) queryClient.setQueryData(CLAVE_ALERTAS_VENCIMIENTO, contexto.previo)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: CLAVE_ALERTAS_VENCIMIENTO })
      void queryClient.invalidateQueries({ queryKey: ['reportes'] }) // contadores de alertas activas
    },
  })
}
