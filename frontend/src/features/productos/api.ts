import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'
import type { Paginado } from '@/types'

export interface Categoria {
  id: number
  nombre: string
  descripcion: string | null
}

export interface UnidadMedida {
  id: number
  nombre: string
  abreviatura: string
}

export interface Presentacion {
  id: number
  nombre: string
  descripcion: string | null
}

export type MotivoDesactivacion = 'descontinuado' | 'sin_stock' | 'baja_rotacion' | 'cambio_proveedor' | 'otro'

export const MOTIVOS_DESACTIVACION: { value: MotivoDesactivacion; label: string }[] = [
  { value: 'descontinuado', label: 'Producto descontinuado' },
  { value: 'sin_stock', label: 'Sin stock permanente' },
  { value: 'baja_rotacion', label: 'Baja rotación' },
  { value: 'cambio_proveedor', label: 'Cambio de proveedor' },
  { value: 'otro', label: 'Otro motivo' },
]

export interface Producto {
  id: number
  codigo: string
  nombre: string
  categoria: number | null
  categoria_nombre: string | null
  unidad_medida: number | null
  unidad_medida_nombre: string | null
  presentacion: number | null
  presentacion_nombre: string | null
  imagen: string | null
  descripcion: string | null
  activo: boolean
  motivo_desactivacion: MotivoDesactivacion | null
  motivo_desactivacion_display: string | null
  motivo_desactivacion_detalle: string | null
  fecha_desactivacion: string | null
  stock_total: number
  fecha_creacion: string
  fecha_actualizacion: string
}

// HU02: datos del formulario de alta, con el lote inicial opcional
export interface NuevoProductoInput {
  nombre: string
  categoria: string
  unidad_medida: string
  presentacion?: string
  descripcion?: string
  imagen?: File | null
  lote_cantidad?: string
  lote_vencimiento?: string
  lote_numero?: string
}

// HU03: solo las características editables de la ficha (no el estado)
export interface EditarProductoInput {
  nombre: string
  categoria: string
  unidad_medida: string
  presentacion?: string
  descripcion?: string
  imagen?: File | null
}

function aFormData<T extends object>(datos: T) {
  const form = new FormData()
  for (const [clave, valor] of Object.entries(datos)) {
    if (valor === undefined || valor === null || valor === '') continue
    form.append(clave, valor instanceof File ? valor : String(valor))
  }
  return form
}

export function useProductos(filtros: { search?: string; categoria?: string }) {
  const params = new URLSearchParams()
  if (filtros.search) params.set('search', filtros.search)
  if (filtros.categoria) params.set('categoria', filtros.categoria)
  const qs = params.toString()

  return useQuery({
    queryKey: ['productos', filtros],
    queryFn: () => api.get<Paginado<Producto>>(`/productos/${qs ? `?${qs}` : ''}`),
  })
}

export function useCategorias() {
  return useQuery({
    queryKey: ['categorias'],
    queryFn: () => api.get<Paginado<Categoria>>('/categorias/?page_size=100'),
  })
}

export function useUnidadesMedida() {
  return useQuery({
    queryKey: ['unidades-medida'],
    queryFn: () => api.get<Paginado<UnidadMedida>>('/unidades-medida/?page_size=100'),
  })
}

export function usePresentaciones() {
  return useQuery({
    queryKey: ['presentaciones'],
    queryFn: () => api.get<Paginado<Presentacion>>('/presentaciones/?page_size=100'),
  })
}

export function useCrearProducto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (datos: NuevoProductoInput) => api.postForm<Producto>('/productos/', aFormData(datos)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['productos'] }),
  })
}

export function useActualizarProducto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: EditarProductoInput }) =>
      api.patchForm<Producto>(`/productos/${id}/`, aFormData(datos)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['productos'] }),
  })
}

// Reactivar un producto desactivado
export function useActivarProducto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.post<Producto>(`/productos/${id}/activar/`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['productos'] }),
  })
}

// HU05: motivo obligatorio, el backend exige uno de MOTIVOS_DESACTIVACION
export function useDesactivarProducto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, motivo, detalle }: { id: number; motivo: MotivoDesactivacion; detalle?: string }) =>
      api.post<Producto>(`/productos/${id}/desactivar/`, {
        motivo_desactivacion: motivo,
        motivo_desactivacion_detalle: detalle,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['productos'] }),
  })
}
