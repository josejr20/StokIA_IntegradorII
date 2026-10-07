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

export function useVentas() {
  return useQuery({
    queryKey: ['ventas'],
    queryFn: async () => {
      const respuesta = await api.get<{ data: Venta[] }>('/ventas')
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
    },
  })
}
