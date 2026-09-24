import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'
import type { Producto, Categorie, UnidadMedida, Presentacion, CatalogoMarca, CatalogoValor, MotivoDesactivacion, TipoEnvase, ProductoPresentacion } from '@/types'

export type { Producto, MotivoDesactivacion } from '@/types'

// HU02: Motivos de desactivación que el backend exige (productoController.desactivar).
export const MOTIVOS_DESACTIVACION: { value: MotivoDesactivacion; label: string }[] = [
  { value: 'agotado', label: 'Agotado' },
  { value: 'caducado', label: 'Caducado / vencido' },
  { value: 'sustituto', label: 'Sustituido por otro producto' },
  { value: 'rectificado', label: 'Error de registro / rectificado' },
  { value: 'otro', label: 'Otro motivo' },
]

// El backend Express devuelve { data: [...] } para listas y { data: {...} } para un
// solo registro. Para las listas de catálogo usamos un helper que extrae el array.
function useDatos<T>(path: string, queryKey: string, params?: URLSearchParams) {
  const qs = params?.toString()
  return useQuery({
    queryKey: [queryKey, qs ?? ''],
    queryFn: async () => {
      const respuesta = await api.get<{ data: T[] }>(`${path}${qs ? `?${qs}` : ''}`)
      return { results: respuesta.data }
    },
  })
}

export function useProductos(filtros: { search?: string; categoria?: string; marca?: string }) {
  const params = new URLSearchParams()
  if (filtros.search) params.set('search', filtros.search)
  if (filtros.categoria) params.set('categoria_id', filtros.categoria)
  if (filtros.marca) params.set('marca_id', filtros.marca)
  return useDatos<Producto>('/productos', 'productos', params)
}

export function useCategorias() {
  return useDatos<Categorie>('/categorias', 'categorias')
}

export function useUnidadesMedida() {
  return useDatos<UnidadMedida>('/unidades-medida', 'unidades-medida')
}

export function usePresentaciones() {
  return useDatos<Presentacion>('/presentaciones', 'presentaciones')
}

export function useTiposEnvase() {
  return useDatos<TipoEnvase>('/tipos-envase', 'tipos-envase')
}

export function useMarcas(familiaId?: string) {
  const params = new URLSearchParams()
  if (familiaId) params.set('familias', familiaId)
  return useDatos<CatalogoMarca>('/catalogo-marcas', 'marcas', params)
}

export function useCatalogoValores() {
  return useDatos<CatalogoValor>('/catalogo-valores', 'catalogo-valores')
}

// HU02: datos del formulario de alta — solo la ficha del producto
export interface NuevoProductoInput {
  nombre: string
  categoria: string
  unidad_medida: string
  presentacion?: string
  marca?: string
  contenido_valor?: number
  categoria_paquete?: number
  contenido_paquete_cantidad?: number
  contenido_paquete_envase?: number
  precio_venta?: string
  caracteristicas?: Record<string, unknown>
  presentaciones_niveles?: Array<Pick<ProductoPresentacion, 'nivel' | 'envase_id' | 'cantidad'>>
  descripcion?: string
  imagen?: File | null
}

// HU03: solo las características editables de la ficha (no el estado)
export interface EditarProductoInput {
  nombre: string
  categoria: string
  unidad_medida: string
  presentacion?: string
  marca?: string
  contenido_valor?: number
  categoria_paquete?: number
  contenido_paquete_cantidad?: number
  contenido_paquete_envase?: number
  precio_venta?: string
  caracteristicas?: Record<string, unknown>
  descripcion?: string
  imagen?: File | null
}

function aProductoJson(datos: NuevoProductoInput | EditarProductoInput) {
  const { imagen: _imagen, categoria, unidad_medida, presentacion, marca, categoria_paquete, contenido_paquete_envase, ...resto } = datos
  return {
    ...resto,
    ...(categoria ? { categoria_id: Number(categoria) } : {}),
    ...(unidad_medida ? { unidad_medida_id: Number(unidad_medida) } : {}),
    ...(presentacion ? { presentacion_id: Number(presentacion) } : {}),
    ...(marca ? { marca_id: Number(marca) } : {}),
    ...(categoria_paquete !== undefined && categoria_paquete !== null ? { categoria_paquete_id: Number(categoria_paquete) } : {}),
    ...(contenido_paquete_envase !== undefined && contenido_paquete_envase !== null ? { contenido_paquete_envase_id: Number(contenido_paquete_envase) } : {}),
  }
}

function aProductoFormData(datos: NuevoProductoInput | EditarProductoInput) {
  const json = aProductoJson(datos)
  const formData = new FormData()
  for (const [clave, valor] of Object.entries(json)) {
    if (valor === undefined || valor === null || valor === '') continue
    formData.append(clave, typeof valor === 'object' ? JSON.stringify(valor) : String(valor))
  }
  if (datos.imagen) formData.append('imagen', datos.imagen)
  return formData
}

export function useCreacionProducto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (datos: NuevoProductoInput) =>
      api.postForm<{ data: Producto }>('/productos', aProductoFormData(datos)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['productos'] }),
  })
}

export function useActualizaProducto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, datos }: { id: number; datos: EditarProductoInput }) =>
      api.putForm<{ data: Producto }>(`/productos/${id}`, aProductoFormData(datos)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['productos'] }),
  })
}

// Reactivar un producto desactivado
export function useActivarProducto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.patch<{ data: Producto }>(`/productos/${id}/activar`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['productos'] }),
  })
}

// Ingreso de stock para un producto ya existente — el que refleja en el kardex
export interface IngresoInput {
  id: number
  cantidad: string
  precio_unitario: string
  motivo?: string
}

export function useIngresoProducto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...datos }: IngresoInput) => api.post(`/productos/${id}/ingreso`, datos),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productos'] })
      queryClient.invalidateQueries({ queryKey: ['movimientos'] })
    },
  })
}

// HU05: motivo obligatorio, el backend exige uno de MOTIVOS_DESACTIVACION
export function useDesactivarProducto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, motivo, detalle }: { id: number; motivo: MotivoDesactivacion; detalle?: string }) =>
      api.patch<{ data: Producto }>(`/productos/${id}/desactivar`, {
        motivo_desactivacion: motivo,
        motivo_desactivacion_detalle: detalle,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['productos'] }),
  })
}

export const useCrearProducto = useCreacionProducto
export const useActualizarProducto = useActualizaProducto