import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'
import type { Paginado } from '@/types'

// Tipos y constantes compartidas con el módulo de kardex (una sola fuente de verdad).
export type TipoMovimiento = 'ingreso' | 'salida' | 'ajuste'
export type OrigenMovimiento = 'compra' | 'venta' | 'inicial' | 'ajuste' | 'otro'

export const TIPOS_MOVIMIENTO: { value: TipoMovimiento; label: string }[] = [
  { value: 'ingreso', label: 'Ingreso' },
  { value: 'salida', label: 'Salida' },
  { value: 'ajuste', label: 'Ajuste' },
]

export const ORIGENES_MOVIMIENTO: { value: OrigenMovimiento; label: string }[] = [
  { value: 'compra', label: 'Compra' },
  { value: 'venta', label: 'Venta' },
  { value: 'inicial', label: 'Registro inicial' },
  { value: 'ajuste', label: 'Ajuste de inventario' },
  { value: 'otro', label: 'Otro' },
]

export interface Lote {
  id: number
  producto_id: number
  producto_nombre: string
  numero_lote: string
  cantidad_inicial: number
  cantidad_actual: number
  fecha_ingreso: string
  fecha_vencimiento: string
  fecha_creacion: string
  estado?: 'AGOTADO' | 'VENCIDO' | 'POR_VENCER' | 'VIGENTE'
  dias_para_vencer?: number | null
}

export interface MovimientoInventario {
  id: number
  lote: number
  lote_numero: string
  producto_id: number
  producto_nombre: string
  producto_codigo: string
  tipo: TipoMovimiento
  tipo_display: string
  origen: OrigenMovimiento
  origen_display: string
  cantidad: number
  precio_unitario: number | null
  precio_total: number | null
  saldo_cantidad: number
  saldo_precio_unitario: number
  saldo_valorizado: number
  motivo: string | null
  usuario: number | null
  usuario_nombre: string | null
  fecha: string
}

export interface FiltrosLotes {
  search?: string
  producto?: string
  page?: number
  pageSize?: number
}

export interface FiltrosMovimientos {
  search?: string
  producto?: string
  tipo?: TipoMovimiento | ''
  origen?: OrigenMovimiento | ''
  fecha_desde?: string
  fecha_hasta?: string
  desdeUltimoIngreso?: boolean
  page?: number
  pageSize?: number
}

export function useLotes(filtros: FiltrosLotes = {}) {
  const params = new URLSearchParams()
  if (filtros.search) params.set('search', filtros.search)
  if (filtros.producto) params.set('producto', filtros.producto)
  if (filtros.page && filtros.page > 1) params.set('page', String(filtros.page))
  params.set('page_size', String(filtros.pageSize || 10))

  return useQuery({
    queryKey: ['lotes', filtros],
    queryFn: async () => {
      const respuesta = await api.get<Paginado<Lote>>(`/lotes/${params.toString() ? `?${params.toString()}` : ''}`)
      return {
        results: respuesta.data,
        count: respuesta.count ?? respuesta.data.length,
        previous: respuesta.previous ?? false,
        next: respuesta.next ?? false,
      }
    },
  })
}

export function useLote(id: number) {
  return useQuery({
    queryKey: ['lotes', id],
    queryFn: async () => {
      const respuesta = await api.get<{ data: Lote }>(`/lotes/${id}/`)
      return respuesta.data
    },
    enabled: !!id,
  })
}

export function useMovimientosInventario(filtros: FiltrosMovimientos = {}) {
  const params = new URLSearchParams()
  if (filtros.search) params.set('search', filtros.search)
  if (filtros.producto) params.set('producto', filtros.producto)
  if (filtros.tipo) params.set('tipo', filtros.tipo)
  if (filtros.origen) params.set('origen', filtros.origen)
  if (filtros.fecha_desde) params.set('fecha_desde', filtros.fecha_desde)
  if (filtros.fecha_hasta) params.set('fecha_hasta', filtros.fecha_hasta)
  if (filtros.desdeUltimoIngreso) params.set('desde_ultimo_ingreso', 'true')
  if (filtros.page && filtros.page > 1) params.set('page', String(filtros.page))
  params.set('page_size', String(filtros.pageSize || 10))

  return useQuery({
    queryKey: ['movimientos-inventario', filtros],
    queryFn: async () => {
      const respuesta = await api.get<Paginado<MovimientoInventario>>(`/movimientos/?${params.toString()}`)
      return {
        results: respuesta.data,
        count: respuesta.count ?? respuesta.data.length,
        previous: respuesta.previous ?? false,
        next: respuesta.next ?? false,
      }
    },
  })
}

export function useHistorialLote(loteId: number) {
  return useQuery({
    queryKey: ['lotes', loteId, 'historial'],
    queryFn: async () => {
      const respuesta = await api.get<{ data: MovimientoInventario[] }>(`/lotes/${loteId}/historial/`)
      return respuesta.data
    },
    enabled: !!loteId,
  })
}

export interface CrearLoteInput {
  producto: number
  numero_lote: string
  cantidad_inicial: string
  fecha_ingreso: string
  fecha_vencimiento: string
}

export function useCreatorLote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (datos: CrearLoteInput) => api.post<{ data: Lote }>('/lotes/', {
      ...datos,
      producto_id: datos.producto,
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lotes'] }),
  })
}

export interface ActualizarLoteInput {
  numero_lote?: string
  cantidad_inicial?: string
  fecha_vencimiento?: string
}

export function useActualizaLote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: ActualizarLoteInput }) =>
      api.patch<{ data: Lote }>(`/lotes/${id}/`, datos),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lotes'] }),
  })
}

export function useEliminarLote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.del<{ message: string }>(`/lotes/${id}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lotes'] })
      queryClient.invalidateQueries({ queryKey: ['movimientos-inventario'] })
      queryClient.invalidateQueries({ queryKey: ['movimientos'] })
    },
  })
}

export interface RegistrarMovimientoInput {
  loteId: number
  tipo: TipoMovimiento
  cantidad: string
  origen?: OrigenMovimiento
  motivo?: string
  precio_unitario?: string
}

export function useRegistrarMovimiento() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ loteId, ...datos }: RegistrarMovimientoInput) =>
      api.post<{ data: MovimientoInventario }>(`/lotes/${loteId}/registrar-movimiento`, datos),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lotes'] })
      queryClient.invalidateQueries({ queryKey: ['movimientos-inventario'] })
      queryClient.invalidateQueries({ queryKey: ['movimientos'] })
    },
  })
}