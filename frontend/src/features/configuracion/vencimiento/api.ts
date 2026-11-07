import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'

// HU-118 (US-23): umbral de días para la alerta de vencimiento.

export type OrigenUmbral = 'categoria' | 'global' | 'predeterminado'

export interface UmbralGeneral {
  dias: number
  configurado: boolean
  origen: OrigenUmbral
  fecha_actualizacion: string | null
}

export interface UmbralCategoria {
  categoria_id: number
  nombre: string
  dias: number
  configurado: boolean
  origen: OrigenUmbral
  fecha_actualizacion: string | null
}

export interface ConfiguracionVencimiento {
  general: UmbralGeneral
  categorias: UmbralCategoria[]
  dias_predeterminado: number
}

export interface LoteEnRiesgo {
  lote_id: number
  numero_lote: string
  producto_id: number
  producto_codigo: string | null
  producto_nombre: string | null
  categoria_id: number | null
  cantidad_actual: number
  fecha_vencimiento: string
  dias_restantes: number
  umbral_dias: number
  origen_umbral: OrigenUmbral
  estado: 'vencido' | 'en_riesgo'
  severidad: 'baja' | 'media' | 'alta' | 'critica'
}

export interface RiesgoVencimiento {
  fecha_calculo: string
  lotes_evaluados: number
  total_en_riesgo: number
  data: LoteEnRiesgo[]
}

/** Respuesta de guardar/restablecer: incluye el mensaje de confirmación (TC-07). */
export interface RespuestaCambioUmbral {
  message: string
  aviso: string | null
  data: { dias: number; dias_anterior?: number; categoria_nombre?: string | null }
}

const CLAVE = ['hu118-umbral-vencimiento']
const CLAVE_RIESGO = ['hu118-riesgo-vencimiento']

export function useConfiguracionVencimiento() {
  return useQuery({
    queryKey: CLAVE,
    queryFn: async () => (await api.get<{ data: ConfiguracionVencimiento }>('/umbrales/vencimiento')).data,
  })
}

export function useRiesgoVencimiento() {
  return useQuery({
    queryKey: CLAVE_RIESGO,
    queryFn: () => api.get<RiesgoVencimiento>('/umbrales/vencimiento/riesgo'),
  })
}

function useRefrescar() {
  const cliente = useQueryClient()
  return () => Promise.all([
    cliente.invalidateQueries({ queryKey: CLAVE }),
    cliente.invalidateQueries({ queryKey: CLAVE_RIESGO }),
    // Los lotes muestran su estado (POR_VENCER) según este umbral.
    cliente.invalidateQueries({ queryKey: ['lotes'] }),
  ])
}

/** categoriaId = null guarda el umbral general. */
export function useGuardarUmbralVencimiento() {
  const refrescar = useRefrescar()
  return useMutation({
    mutationFn: ({ categoriaId, dias }: { categoriaId: number | null; dias: number }) =>
      api.put<RespuestaCambioUmbral>(
        categoriaId === null ? '/umbrales/vencimiento' : `/umbrales/vencimiento/categorias/${categoriaId}`,
        { dias },
      ),
    onSuccess: refrescar,
  })
}

export function useRestablecerUmbralCategoria() {
  const refrescar = useRefrescar()
  return useMutation({
    mutationFn: (categoriaId: number) =>
      api.del<RespuestaCambioUmbral>(`/umbrales/vencimiento/categorias/${categoriaId}`),
    onSuccess: refrescar,
  })
}

export function useEvaluarVencimiento() {
  const refrescar = useRefrescar()
  return useMutation({
    mutationFn: () => api.post<{ message: string; data: { creadas: number; actualizadas: number; resueltas: number } }>(
      '/umbrales/vencimiento/evaluar', {},
    ),
    onSuccess: refrescar,
  })
}
