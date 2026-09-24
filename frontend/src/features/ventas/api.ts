import { useQuery } from '@tanstack/react-query'

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

export function useVentas() {
  return useQuery({
    queryKey: ['ventas'],
    queryFn: async () => {
      const respuesta = await api.get<{ data: Venta[] }>('/ventas')
      return respuesta.data
    },
  })
}
