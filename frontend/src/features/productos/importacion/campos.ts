/**
 * Contrato de columnas del archivo de carga masiva de productos.
 *
 * Este archivo es la única fuente de verdad: de aquí salen las columnas que
 * se le piden al usuario en el paso 1 del asistente, la plantilla que se
 * descarga y la normalización de encabezados que se usa al leer el archivo.
 *
 * Las columnas replican exactamente los campos del formulario de alta
 * (components/NuevoProductoModal.tsx). El código del producto NO aparece a
 * propósito: lo genera el backend al guardar.
 */

export type FormatoArchivo = 'csv' | 'excel'

export type TipoColumna = 'texto' | 'numero' | 'catalogo'

/** Catálogo contra el que se resuelve el valor escrito por el usuario. */
export type ClaveCatalogo = 'categoria' | 'unidad_medida' | 'marca' | 'tipo_envase'

export interface DefinicionColumna {
  /** Clave interna con la que se manda la fila al backend. */
  clave: string
  /** Nombre de la columna en la plantilla y en la ayuda al usuario. */
  etiqueta: string
  tipo: TipoColumna
  obligatorio: boolean
  /** Las columnas de tipo 'catalogo' se resuelven por nombre contra este catálogo. */
  catalogo?: ClaveCatalogo
  ejemplo: string
  ayuda: string
  /** Encabezados alternativos aceptados, ya normalizados con `normalizarEncabezado`. */
  alias: string[]
}

export const FORMATOS_ARCHIVO: { valor: FormatoArchivo; etiqueta: string; descripcion: string; acept: string }[] = [
  {
    valor: 'csv',
    etiqueta: 'CSV',
    descripcion: 'Un solo archivo de texto con los datos separados por comas.',
    acept: '.csv,text/csv',
  },
  {
    valor: 'excel',
    etiqueta: 'Excel',
    descripcion: 'Hoja de cálculo de Excel (.xlsx). Se lee la primera hoja.',
    acept: '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
]

export const COLUMNAS_PRODUCTO: DefinicionColumna[] = [
  {
    clave: 'nombre',
    etiqueta: 'nombre',
    tipo: 'texto',
    obligatorio: true,
    ejemplo: 'AJI-NO-MEN CARNE',
    ayuda: 'Nombre comercial del producto, sin el contenido ni el empaque. Máximo 200 caracteres.',
    alias: ['nombre_comercial', 'nombrecomercial', 'producto', 'nombre_del_producto'],
  },
  {
    clave: 'categoria',
    etiqueta: 'categoria',
    tipo: 'catalogo',
    obligatorio: true,
    catalogo: 'categoria',
    ejemplo: 'Aji',
    ayuda: 'Nombre exacto de una categoría del catálogo, o su id numérico.',
    alias: ['categorias', 'categoria_id'],
  },
  {
    clave: 'unidad_medida',
    etiqueta: 'unidad_medida',
    tipo: 'catalogo',
    obligatorio: true,
    catalogo: 'unidad_medida',
    ejemplo: 'GR',
    ayuda: 'Nombre o abreviatura de la unidad de medida (GR, ML, UND…).',
    alias: ['unidad', 'unidad_de_medida', 'medida', 'unidad_medida_id'],
  },
  {
    clave: 'categoria_paquete',
    etiqueta: 'categoria_paquete',
    tipo: 'catalogo',
    obligatorio: true,
    catalogo: 'tipo_envase',
    ejemplo: 'CAJA',
    ayuda: 'Cómo se vende el producto: UNIDAD, CAJA, PAQUETE, BOLSA…',
    alias: [
      'categoria_de_paquete',
      'categoria_paquete_id',
      'tipo_envase',
      'envase',
      'empaque',
    ],
  },
  {
    clave: 'marca',
    etiqueta: 'marca',
    tipo: 'catalogo',
    obligatorio: false,
    catalogo: 'marca',
    ejemplo: 'AJINOMOTO',
    ayuda: 'Marca del catálogo. Si se deja vacío el producto se registra sin marca.',
    alias: ['marca_id', 'nombre_marca'],
  },
  {
    clave: 'contenido_valor',
    etiqueta: 'contenido_valor',
    tipo: 'numero',
    obligatorio: false,
    ejemplo: '80',
    ayuda: 'Cantidad neta de contenido. Acepta 80, 80.50 o 80,50.',
    alias: ['contenido', 'valor_contenido', 'cantidad_contenido'],
  },
  {
    clave: 'contenido_paquete_cantidad',
    etiqueta: 'contenido_paquete_cantidad',
    tipo: 'numero',
    obligatorio: false,
    ejemplo: '24',
    ayuda: 'Cuántas unidades trae el empaque. Se usa junto con contenido_paquete_envase.',
    alias: [
      'contenido_del_paquete',
      'contenido_paquete',
      'cantidad_paquete',
      'contenido_envase_cantidad',
    ],
  },
  {
    clave: 'contenido_paquete_envase',
    etiqueta: 'contenido_paquete_envase',
    tipo: 'catalogo',
    obligatorio: false,
    catalogo: 'tipo_envase',
    ejemplo: 'SOBRES',
    ayuda: 'Envase de cada unidad del empaque. Vacío si el producto se vende suelto.',
    alias: [
      'envase_del_contenido',
      'envase_contenido',
      'envase_paquete',
      'contenido_paquete_envase_id',
    ],
  },
  {
    clave: 'precio_venta',
    etiqueta: 'precio_venta',
    tipo: 'numero',
    obligatorio: false,
    ejemplo: '12.50',
    ayuda: 'Precio de venta en soles. Acepta S/ 12.50, 12,50 o 12.50.',
    alias: ['precio', 'precio_de_venta', 'precio_venta_unitario'],
  },
  {
    clave: 'descripcion',
    etiqueta: 'descripcion',
    tipo: 'texto',
    obligatorio: false,
    ejemplo: 'Sazón de ají molido',
    ayuda: 'Detalle libre del producto. Se puede dejar vacío.',
    alias: ['descripcion_producto', 'detalle'],
  },
]

export const COLUMNAS_OBLIGATORIAS = COLUMNAS_PRODUCTO.filter((columna) => columna.obligatorio)

/**
 * Encabezados de la primera fila, tal como deben aparecer en el
 * archivo: separados por coma y en el orden de COLUMNAS_PRODUCTO.
 */
export function encabezadosCsv(): string {
  return COLUMNAS_PRODUCTO.map((columna) => columna.etiqueta).join(',')
}

/**
 * Normaliza un texto para poder compararlo: minúsculas, sin tildes y sin
 * signos de puntuación. Así "Categoría de Paquete", "categoria_de_paquete" y
 * "CATEGORÍA DE PAQUETE" terminan siendo la misma clave.
 */
export function normalizarEncabezado(valor: string): string {
  return valor
    .replace(/^\uFEFF/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/** Índice alias -> clave, para resolver los encabezados de una sola vez. */
const CLAVE_POR_ALIAS: Map<string, string> = (() => {
  const indice = new Map<string, string>()
  for (const columna of COLUMNAS_PRODUCTO) {
    indice.set(normalizarEncabezado(columna.etiqueta), columna.clave)
    for (const alias of columna.alias) indice.set(normalizarEncabezado(alias), columna.clave)
  }
  return indice
})()

export function resolverColumna(encabezado: string): string | null {
  return CLAVE_POR_ALIAS.get(normalizarEncabezado(encabezado)) ?? null
}
