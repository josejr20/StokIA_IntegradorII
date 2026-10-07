import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'

export interface Venta {
  id: number
  producto_id: number
  producto_nombre: string | null
  lote_id: number | null
  cantidad: number
  precio_unitario: number | null
  fecha_venta: string
  origen: string
  fecha_creacion: string
}

export interface ErrorImportacionVenta {
  fila: number
  codigo: string
  motivo: string
}

export interface ResultadoImportacionVenta {
  importacion_id: number
  total: number
  procesadas: number
  rechazadas: number
  errores: ErrorImportacionVenta[]
}

export interface ResultadoResumenVenta {
  total_cantidad: number
  total_monto: number
  origenes_incluidos: string[]
}

export function useVentasResumen(filtros: { producto?: string; fecha_desde?: string; fecha_hasta?: string; incluir_ajustes?: boolean }) {
  const params = new URLSearchParams()
  if (filtros.producto) params.set('producto', filtros.producto)
  if (filtros.fecha_desde) params.set('fecha_desde', filtros.fecha_desde)
  if (filtros.fecha_hasta) params.set('fecha_hasta', filtros.fecha_hasta)
  if (filtros.incluir_ajustes) params.set('incluir_ajustes', 'true')

  return useQuery({
    queryKey: ['ventas-resumen', filtros],
    queryFn: async () => {
      const qs = params.toString()
      const respuesta = await api.get<{ data: ResultadoResumenVenta }>(`/ventas/resumen?${qs}`)
      return respuesta.data
    },
  })
}

export function useVentas(filtros: { producto?: string; fecha_desde?: string; fecha_hasta?: string } = {}) {
  const params = new URLSearchParams()
  if (filtros.producto) params.set('producto', filtros.producto)
  if (filtros.fecha_desde) params.set('fecha_desde', filtros.fecha_desde)
  if (filtros.fecha_hasta) params.set('fecha_hasta', filtros.fecha_hasta)

  return useQuery({
    queryKey: ['ventas', filtros],
    queryFn: async () => {
      const qs = params.toString()
      const respuesta = await api.get<{ data: Venta[] }>(qs ? `/ventas?${qs}` : '/ventas')
      return respuesta.data
    },
  })
}

export function useImportarVentas() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (archivo: File) => {
      const formData = new FormData()
      formData.append('archivo', archivo)
      return api.postForm<ResultadoImportacionVenta>('/ventas/importar', formData)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ventas'] })
      void queryClient.invalidateQueries({ queryKey: ['ventas-resumen'] })
    },
  })
}
