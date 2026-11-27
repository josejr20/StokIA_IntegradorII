/**
 * US-36 · Cliente de la API de auditoría (solo lectura).
 * No existe ninguna mutación: el historial no se puede editar ni borrar.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'

export interface RegistroAuditoria {
  id: number
  usuario_id: number | null
  usuario_nombre: string | null
  usuario_email: string | null
  accion: string
  entidad: string
  entidad_id: number | null
  detalle: Record<string, unknown> | null
  fecha: string
}

export interface MetaAuditoria {
  page: number
  limit: number
  total: number
  totalPages: number
  orden: 'asc' | 'desc'
}

export interface FiltrosAuditoria {
  usuario_id?: string
  entidad?: string
  fecha_desde?: string
  fecha_hasta?: string
  orden?: 'asc' | 'desc'
  page?: number
  limit?: number
}

export interface OpcionesFiltroAuditoria {
  usuarios: { id: number; nombre: string; email: string }[]
  entidades: string[]
}

/** Arma el query string solo con los filtros que tienen valor. */
export function armarParametros(filtros: FiltrosAuditoria): string {
  const params = new URLSearchParams()
  if (filtros.usuario_id) params.set('usuario_id', filtros.usuario_id)
  if (filtros.entidad) params.set('entidad', filtros.entidad)
  if (filtros.fecha_desde) params.set('fecha_desde', filtros.fecha_desde)
  if (filtros.fecha_hasta) params.set('fecha_hasta', filtros.fecha_hasta)
  params.set('orden', filtros.orden ?? 'desc')
  params.set('page', String(filtros.page ?? 1))
  params.set('limit', String(filtros.limit ?? 20))
  return params.toString()
}

/** TC-02 / TC-05 / TC-07: historial cronológico filtrable por usuario o fecha. */
export function useAuditoria(filtros: FiltrosAuditoria) {
  return useQuery({
    queryKey: ['auditoria', filtros],
    queryFn: () =>
      api.get<{ data: RegistroAuditoria[]; meta: MetaAuditoria }>(`/auditoria?${armarParametros(filtros)}`),
    // Al cambiar de página se mantiene la anterior en pantalla hasta que llegue la nueva.
    placeholderData: keepPreviousData,
  })
}

/** Usuarios y entidades que aparecen en la auditoría (para los desplegables). */
export function useOpcionesFiltroAuditoria() {
  return useQuery({
    queryKey: ['auditoria', 'filtros'],
    queryFn: async () => (await api.get<{ data: OpcionesFiltroAuditoria }>('/auditoria/filtros')).data,
    staleTime: 60_000,
  })
}
