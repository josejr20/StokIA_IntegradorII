import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'
import type { Paginado } from '@/types'

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

export interface FiltrosKardex {
  search?: string
  producto?: string
  tipo?: TipoMovimiento | ''
  origen?: OrigenMovimiento | ''
  fecha_desde?: string
  fecha_hasta?: string
  desdeUltimoIngreso?: boolean
  pageSize?: string
  page?: number
}

export function useMovimientos(filtros: FiltrosKardex) {
  const params = new URLSearchParams()
  if (filtros.search) params.set('search', filtros.search)
  if (filtros.producto) params.set('producto', filtros.producto)
  if (filtros.tipo) params.set('tipo', filtros.tipo)
  if (filtros.origen) params.set('origen', filtros.origen)
  if (filtros.fecha_desde) params.set('fecha_desde', filtros.fecha_desde)
  if (filtros.fecha_hasta) params.set('fecha_hasta', filtros.fecha_hasta)
  if (filtros.desdeUltimoIngreso) params.set('desde_ultimo_ingreso', 'true')
  if (filtros.page && filtros.page > 1) params.set('page', String(filtros.page))
  params.set('page_size', filtros.pageSize || '10')

  return useQuery({
    queryKey: ['movimientos', filtros],
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
