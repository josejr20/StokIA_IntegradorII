// Tipos compartidos entre frontend y backend Express.
// El backend devuelve { data: [...] } para listas y { data: {...} } para un solo registro.

export interface Paginado<T> {
  data: T[]
}

export interface Producto {
  id: number
  codigo: string
  nombre: string
  categoria: number | null
  categoria_nombre: string | null
  categoria_vida_util_dias: number | null
  unidad_medida: number | null
  unidad_medida_nombre: string | null
  unidad_medida_simbolo: string | null
  presentacion: number | null
  presentacion_nombre: string | null
  marca: number | null
  marca_nombre: string | null
  contenido_valor: number | null
  categoria_paquete_id: number | null
  categoria_paquete_nombre: string | null
  contenido_paquete_cantidad: number | null
  contenido_paquete_envase_id: number | null
  contenido_paquete_envase_nombre: string | null
  precio_venta: string | null
  caracteristicas: Record<string, unknown>
  es_bonificacion: boolean
  imagen: string | null
  descripcion: string | null
  activo: boolean
  motivo_desactivacion: string | null
  motivo_desactivacion_detalle: string | null
  fecha_desactivacion: string | null
  stock_total: number
  fecha_creacion: string
  fecha_actualizacion: string
}

export interface Lote {
  id: number
  producto: number
  producto_nombre: string | null
  numero_lote: string
  cantidad_inicial: number
  cantidad_actual: number
  fecha_ingreso: string
  fecha_vencimiento: string
  fecha_creacion: string
}

export interface MovimientoInventario {
  id: number
  lote_id: number
  lote_numero: string | null
  producto_id: number | null
  producto_nombre: string | null
  producto_codigo: string | null
  tipo: string
  origen: string
  cantidad: number
  precio_unitario: number | null
  precio_total: number | null
  saldo_cantidad: number
  saldo_precio_unitario: number
  saldo_valorizado: number
  motivo: string | null
  usuario_id: number | null
  usuario_nombre: string | null
  fecha: string
  tipo_display: string | null
  origen_display: string | null
}

export interface Categorie {
  id: number
  nombre: string
  descripcion: string | null
  vida_util_dias: number | null
}

export interface UnidadMedida {
  id: number
  nombre: string
  abreviatura: string | null
  simbolo: string | null
}

export interface Presentacion {
  id: number
  nombre: string
  descripcion: string | null
}

export interface TipoEnvase {
  id: number
  nombre: string
  activo: boolean
}

export interface ProductoPresentacion {
  id?: number
  producto_id?: number
  nivel: number
  envase_id: number
  cantidad: number | string
  envase_nombre?: string | null
}

export interface CatalogoMarca {
  id: number
  nombre: string
  familias: number[]
}

export interface CatalogoValor {
  id: number
  tipo: string
  valor: string
  etiqueta: string | null
}

export interface Rol {
  id: number
  nombre: string
}

export interface Permiso {
  id: number
  nombre: string
  clave: string
}

export type MotivoDesactivacion =
  | 'agotado'
  | 'caducado'
  | 'sustituto'
  | 'rectificado'
  | 'otro'

export const MOTIVOS_DESACTIVACION: { value: MotivoDesactivacion; label: string }[] = [
  { value: 'agotado', label: 'Agotado' },
  { value: 'caducado', label: 'Caducado / vencido' },
  { value: 'sustituto', label: 'Sustituido por otro producto' },
  { value: 'rectificado', label: 'Error de registro / rectificado' },
  { value: 'otro', label: 'Otro motivo' },
]