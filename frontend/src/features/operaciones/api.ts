import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'
import type { Cliente, Comprobante, Operacion, TipoOperacion } from '@/types'

// ============ Operaciones ============

export interface FiltrosOperaciones {
  tipo?: TipoOperacion | ''
  cliente_id?: number
  fecha_desde?: string
  fecha_hasta?: string
  buscar?: string
}

export function useOperaciones(filtros: FiltrosOperaciones = {}) {
  const params = new URLSearchParams()
  if (filtros.tipo) params.set('tipo', filtros.tipo)
  if (filtros.cliente_id) params.set('cliente_id', String(filtros.cliente_id))
  if (filtros.fecha_desde) params.set('fecha_desde', filtros.fecha_desde)
  if (filtros.fecha_hasta) params.set('fecha_hasta', filtros.fecha_hasta)
  if (filtros.buscar) params.set('buscar', filtros.buscar)
  const qs = params.toString()

  return useQuery({
    queryKey: ['operaciones', qs],
    queryFn: async () => {
      const respuesta = await api.get<{ data: Operacion[] }>(`/operaciones${qs ? `?${qs}` : ''}`)
      return respuesta.data
    },
  })
}

export function useOperacion(id: number | null) {
  return useQuery({
    queryKey: ['operaciones', id],
    queryFn: async () => {
      const respuesta = await api.get<{ data: Operacion }>(`/operaciones/${id}`)
      return respuesta.data
    },
    enabled: id !== null,
  })
}

export interface LineaOperacionInput {
  producto_id: number
  cantidad: number
  precio_unitario: number
  lote_id?: number | null
}

export interface CrearOperacionInput {
  tipo: TipoOperacion
  cliente_id?: number | null
  items: LineaOperacionInput[]
  fecha?: string
  motivo?: string
  operacion_origen_id?: number | null
  signo?: 'aumenta' | 'disminuye'
  idempotency_key: string
}

/** Invalida todo lo que toca una operación: inventario, kardex, ventas y reportes. */
function invalidarOperacion(queryClient: ReturnType<typeof useQueryClient>) {
  return () => {
    queryClient.invalidateQueries({ queryKey: ['operaciones'] })
    queryClient.invalidateQueries({ queryKey: ['ventas'] })
    queryClient.invalidateQueries({ queryKey: ['lotes'] })
    queryClient.invalidateQueries({ queryKey: ['movimientos-inventario'] })
    queryClient.invalidateQueries({ queryKey: ['productos'] })
    queryClient.invalidateQueries({ queryKey: ['inicio'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }
}

export function useCrearOperacion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (datos: CrearOperacionInput) =>
      api.post<{ data: Operacion }>('/operaciones', datos),
    onSuccess: invalidarOperacion(queryClient),
  })
}

export function useAnularOperacion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.post<{ data: Operacion }>(`/operaciones/${id}/anular`),
    onSuccess: invalidarOperacion(queryClient),
  })
}

export function useComprobante(operacionId: number | null) {
  return useQuery({
    queryKey: ['operaciones', operacionId, 'comprobante'],
    queryFn: async () => {
      const respuesta = await api.get<{ data: Comprobante }>(`/operaciones/${operacionId}/comprobante`)
      return respuesta.data
    },
    refetchOnMount: 'always',
    enabled: operacionId !== null,
  })
}

// ============ Impuesto ============

export function useImpuesto() {
  return useQuery({
    queryKey: ['configuracion', 'impuesto'],
    queryFn: async () => {
      const respuesta = await api.get<{ data: { impuesto_porcentaje: number } }>(
        '/operaciones/configuracion/impuesto',
      )
      return respuesta.data
    },
  })
}

export function useConfigurarImpuesto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (impuesto_porcentaje: number) =>
      api.put<{ data: { impuesto_porcentaje: number } }>(
        '/operaciones/configuracion/impuesto',
        { impuesto_porcentaje },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configuracion', 'impuesto'] })
    },
  })
}

// ============ Clientes ============

export function useClientes(buscar = '') {
  return useQuery({
    queryKey: ['clientes', buscar],
    queryFn: async () => {
      const respuesta = await api.get<{ data: Cliente[] }>(
        buscar ? `/clientes?buscar=${encodeURIComponent(buscar)}` : '/clientes',
      )
      return respuesta.data
    },
  })
}

export function useCliente(id: number | null) {
  return useQuery({
    queryKey: ['clientes', id],
    queryFn: async () => {
      const respuesta = await api.get<{ data: Cliente }>(`/clientes/${id}`)
      return respuesta.data
    },
    enabled: id !== null,
  })
}

export interface HistorialCliente {
  id: number
  numero: string
  tipo: TipoOperacion
  fecha: string
  total: number
  estado: string
}

export function useHistorialCliente(id: number | null) {
  return useQuery({
    queryKey: ['clientes', id, 'historial'],
    queryFn: async () => {
      const respuesta = await api.get<{ data: HistorialCliente[] }>(`/clientes/${id}/historial`)
      return respuesta.data
    },
    enabled: id !== null,
  })
}

export interface ClienteInput {
  nombre: string
  documento?: string | null
  activo?: boolean
}

export function useCrearCliente() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (datos: ClienteInput) => api.post<{ data: Cliente }>('/clientes', datos),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clientes'] }),
  })
}

export function useActualizarCliente() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: ClienteInput }) =>
      api.patch<{ data: Cliente }>(`/clientes/${id}`, datos),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clientes'] }),
  })
}

// ============ Importar Kardex ============

export interface ImportarKardexResultado {
  total_rows: number
  created: number
  skipped: number
  errors: number
  error_details: Array<{ row?: number; presentacion?: string; reason?: string; error?: string }>
}

export function useImportarKardex() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (archivo: File) => {
      const formData = new FormData()
      formData.append('archivo', archivo)
      const respuesta = await api.postForm<{ data: ImportarKardexResultado }>('/importar-kardex/kardex', formData)
      return respuesta.data
    },
    onSuccess: invalidarOperacion(queryClient),
  })
}
