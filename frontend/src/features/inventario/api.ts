import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'
import type { Paginado } from '@/types'

// Tipos y constantes compartidas con el módulo de kardex (una sola fuente de verdad).
// HU8.1: los ajustes se expresan como ingreso/salida con origen='ajuste'.
export type TipoMovimiento = 'ingreso' | 'salida'
export type OrigenMovimiento = 'compra' | 'venta' | 'inicial' | 'ajuste' | 'devolucion' | 'anulacion' | 'otro'

export interface TipoMovimientoItem {
  key: string
  value: TipoMovimiento
  label: string
  origen: OrigenMovimiento
}

export const TIPOS_MOVIMIENTO: TipoMovimientoItem[] = [
  { key: 'ingreso', value: 'ingreso', label: 'Ingreso', origen: 'compra' },
  { key: 'salida', value: 'salida', label: 'Salida', origen: 'venta' },
  { key: 'ajuste-pos', value: 'ingreso', label: 'Ajuste +', origen: 'ajuste' },
  { key: 'ajuste-neg', value: 'salida', label: 'Ajuste −', origen: 'ajuste' },
]

export const ORIGENES_MOVIMIENTO: { value: OrigenMovimiento; label: string }[] = [
  { value: 'compra', label: 'Compra' },
  { value: 'venta', label: 'Venta' },
  { value: 'inicial', label: 'Registro inicial' },
  { value: 'ajuste', label: 'Ajuste de inventario' },
  { value: 'devolucion', label: 'Devolución' },
  { value: 'anulacion', label: 'Anulación de venta' },
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
  fecha_vencimiento: string | null
  fecha_creacion: string
  estado?: 'AGOTADO' | 'VENCIDO' | 'POR_VENCER' | 'VIGENTE'
  dias_para_vencer?: number | null
}

export interface MovimientoInventario {
  id: number
  lote: number
  lote_id: number
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
  if (filtros.search) params.set('numero_lote', filtros.search)
  if (filtros.producto) params.set('producto', filtros.producto)

  return useQuery({
    queryKey: ['lotes', filtros],
    queryFn: async () => {
      const pageSize = filtros.pageSize || 100
      const resultados: Lote[] = []
      let pagina = filtros.page || 1
      let hayMas = true

      while (hayMas) {
        const respuesta = await api.get<Paginado<Lote>>(`/lotes/?page=${pagina}&page_size=${pageSize}&${params.toString()}`)
        resultados.push(...respuesta.data)
        hayMas = respuesta.next ?? false
        pagina += 1
      }

      return {
        results: resultados,
        count: resultados.length,
        previous: false,
        next: false,
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

export function useHistorialProductos(productoIds: number[]) {
  const ids = [...new Set(productoIds)].sort((a, b) => a - b)
  const idsQuery = ids.join(',')
  return useQuery({
    queryKey: ['lotes', 'historial-productos', idsQuery],
    queryFn: async () => {
      const respuesta = await api.get<{ data: MovimientoInventario[] }>(
        `/lotes/historial-productos/?producto_ids=${idsQuery}`,
      )
      return respuesta.data
    },
    enabled: ids.length > 0,
  })
}

export interface CrearLoteInput {
  producto: number
  numero_lote?: string
  cantidad_inicial: string
  fecha_ingreso: string
}

export function useCreatorLote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (datos: CrearLoteInput) => api.post<{ data: Lote }>('/lotes/', {
      ...datos,
      producto_id: datos.producto,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lotes'] })
      queryClient.invalidateQueries({ queryKey: ['productos'] })
    },
  })
}

export interface ActualizarLoteInput {
  numero_lote?: string
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