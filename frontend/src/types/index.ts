// Tipos compartidos entre frontend y backend Express.
// El backend devuelve { data: [...] } para listas y { data: {...} } para un solo registro.

export interface Paginado<T> {
  data: T[]
  count?: number
  previous?: boolean
  next?: boolean
}

export interface Producto {
  id: number
  codigo: string
  nombre: string
  categoria: number | null
  categoria_id: number | null
  categoria_nombre: string | null
  categoria_vida_util_dias: number | null
  unidad_medida: number | null
  unidad_medida_id: number | null
  unidad_medida_nombre: string | null
  unidad_medida_simbolo: string | null
  presentacion: number | null
  presentacion_nombre: string | null
  marca: number | null
  marca_id: number | null
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
  fecha_vencimiento: string | null
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

// ---- Módulo de operaciones (clientes, ventas, devoluciones, ajustes) ----

export interface Cliente {
  id: number
  nombre: string
  documento: string | null
  activo: boolean
  fecha_creacion: string
}

export interface OperacionDetalle {
  id: number
  operacion_id: number
  producto_id: number
  producto_codigo: string | null
  producto_nombre: string | null
  lote_id: number | null
  lote_numero: string | null
  cantidad: number
  cantidad_disponible_devolucion?: number
  precio_unitario: number
  subtotal: number
}

export interface ComprobanteItem {
  producto_id: number
  codigo: string
  producto: string
  cantidad: number
  precio_unitario: number
  subtotal: number
  lote_id: number | null
}

export interface Comprobante {
  id: number
  operacion_id: number
  numero: string
  tipo: 'boleta' | 'factura' | 'nota_credito'
  datos: {
    numero_operacion: string
    numero_comprobante: string
    tipo_comprobante: string
    fecha: string
    cliente: { id: number; nombre: string; documento: string | null } | null
    vendedor: { id: number; nombres: string; apellidos: string; email: string } | null
    items: ComprobanteItem[]
    subtotal: number
    impuesto_porcentaje: number
    impuesto: number
    total: number
    motivo: string | null
    operacion_origen: { id: number; numero: string; fecha: string } | null
  }
  fecha_creacion: string
}

export type TipoOperacion = 'venta' | 'devolucion' | 'ajuste'

export interface Operacion {
  id: number
  numero: string
  tipo: TipoOperacion
  cliente_id: number | null
  cliente?: Cliente | null
  usuario_id: number | null
  usuario_nombre: string | null
  fecha: string
  subtotal: number
  impuesto_porcentaje: number
  impuesto: number
  total: number
  motivo: string | null
  operacion_origen_id: number | null
  operacion_origen_numero: string | null
  estado: 'activa' | 'anulada'
  fecha_creacion: string
  detalles?: OperacionDetalle[]
  comprobante?: Comprobante | null
}