import type { CatalogoMarca, Categorie, TipoEnvase, UnidadMedida } from '@/types'

import {
  COLUMNAS_OBLIGATORIAS,
  COLUMNAS_PRODUCTO,
  normalizarEncabezado,
  resolverColumna,
  type DefinicionColumna,
} from './campos'
import type { ArchivoLeido } from './parseo'
import type { ProductoImportable } from '../api'

export const MAXIMO_FILAS = 500

export interface Catalogos {
  categorias: Categorie[]
  unidades: UnidadMedida[]
  marcas: CatalogoMarca[]
  tiposEnvase: TipoEnvase[]
}

export interface RevisionColumnas {
  /** clave -> encabezado tal como venía escrito en el archivo. */
  encontradas: Record<string, string>
  faltantes: DefinicionColumna[]
  /** Encabezados del archivo que no corresponden a ningún campo conocido. */
  ignoradas: string[]
  duplicadas: string[]
}

export interface FilaValidada {
  /** Número de la fila en la hoja: la primera fila de datos es la 2. */
  numero: number
  nombre: string
  categoria: string
  unidad: string
  categoriaPaquete: string
  datos: ProductoImportable | null
  errores: string[]
}

export interface ResultadoRevision {
  columnas: RevisionColumnas
  /** Filas leídas del archivo, ya recortadas al máximo permitido. */
  filas: FilaValidada[]
  /** Cuántas filas traía el archivo antes de recortar. */
  totalFilas: number
  excedeLimite: boolean
  validas: FilaValidada[]
  conError: FilaValidada[]
}

/**
 * Convierte a número lo que venga en la celda. Acepta el formato que la gente
 * escribe de verdad: "80", "80,50", "S/ 12.50", "$ 1,250.50".
 */
export function parsearNumero(bruto: string): number | null {
  let texto = bruto.trim().replace(/[^\d.,-]/g, '')
  if (!texto) return null

  const ultimaComa = texto.lastIndexOf(',')
  const ultimoPunto = texto.lastIndexOf('.')
  if (ultimaComa > ultimoPunto) {
    // Formato europeo: 1.234,56 -> 1234.56
    texto = texto.replace(/\./g, '').replace(',', '.')
  } else {
    texto = texto.replace(/,/g, '')
  }

  const valor = Number(texto)
  return Number.isFinite(valor) ? valor : null
}

/** Índice de búsqueda de un catálogo: por nombre normalizado y por id. */
function indiceCatalogo<T extends { id: number }>(items: T[], nombres: (item: T) => string[]) {
  const indice = new Map<string, number>()
  for (const item of items) {
    indice.set(String(item.id), item.id)
    for (const nombre of nombres(item)) {
      const clave = normalizarEncabezado(nombre)
      if (clave && !indice.has(clave)) indice.set(clave, item.id)
    }
  }
  return indice
}

export function construirIndices(catalogos: Catalogos) {
  return {
    categorias: indiceCatalogo(catalogos.categorias, (c) => [c.nombre]),
    unidades: indiceCatalogo(catalogos.unidades, (u) => [u.abreviatura ?? '', u.simbolo ?? '', u.nombre]),
    marcas: indiceCatalogo(catalogos.marcas, (m) => [m.nombre]),
    tiposEnvase: indiceCatalogo(catalogos.tiposEnvase, (e) => [e.nombre]),
  }
}

export type IndicesCatalogo = ReturnType<typeof construirIndices>

/** Primera vez que se resuelve una columna, la posición real de la columna. */
export function revisarColumnas(archivo: ArchivoLeido): RevisionColumnas {
  const encontradas: Record<string, string> = {}
  const duplicadas: string[] = []

  for (const encabezado of archivo.encabezados) {
    const clave = resolverColumna(encabezado)
    if (!clave) continue
    if (clave in encontradas) {
      duplicadas.push(encabezado)
      continue
    }
    encontradas[clave] = encabezado
  }

  return {
    encontradas,
    faltantes: COLUMNAS_OBLIGATORIAS.filter((columna) => !(columna.clave in encontradas)),
    ignoradas: archivo.encabezados.filter((encabezado) => !resolverColumna(encabezado)),
    duplicadas,
  }
}

const ETIQUETA_POR_CLAVE: Record<string, string> = Object.fromEntries(
  COLUMNAS_PRODUCTO.map((columna) => [columna.clave, columna.etiqueta]),
)

function resolverCatalogado(
  indice: Map<string, number>,
  valores: Map<string, string>,
  claveColumna: string,
  errores: string[],
): number | null {
  const crudo = (valores.get(claveColumna) ?? '').trim()
  const etiqueta = ETIQUETA_POR_CLAVE[claveColumna] ?? claveColumna

  // Las columnas obligatorias se reportan en la validación de la fila, para
  // no repetir el mismo error una vez por columna y una vez por dato.
  if (!crudo) return null

  const id = indice.get(normalizarEncabezado(crudo))
  if (id === undefined) {
    errores.push(`No existe ${etiqueta} "${crudo}" en el catálogo`)
    return null
  }
  return id
}

function validarFila(celdas: string[], indices: IndicesCatalogo, numero: number): FilaValidada {
  const errores: string[] = []
  const valores = new Map<string, string>()
  COLUMNAS_PRODUCTO.forEach((columna, indice) => valores.set(columna.clave, celdas[indice] ?? ''))

  const nombre = (valores.get('nombre') ?? '').trim()
  if (!nombre) errores.push('Falta el nombre comercial')
  else if (nombre.length > 200) errores.push('El nombre comercial supera los 200 caracteres')

  if (!(valores.get('categoria') ?? '').trim()) errores.push('Falta la categoría')
  if (!(valores.get('unidad_medida') ?? '').trim()) errores.push('Falta la unidad de medida')
  if (!(valores.get('categoria_paquete') ?? '').trim()) errores.push('Falta la categoría de paquete')

  const categoriaId = resolverCatalogado(indices.categorias, valores, 'categoria', errores)
  const unidadId = resolverCatalogado(indices.unidades, valores, 'unidad_medida', errores)
  const marcaId = resolverCatalogado(indices.marcas, valores, 'marca', errores)
  const categoriaPaqueteId = resolverCatalogado(indices.tiposEnvase, valores, 'categoria_paquete', errores)
  const envaseContenidoId = resolverCatalogado(indices.tiposEnvase, valores, 'contenido_paquete_envase', errores)

  const contenidoValorCrudo = (valores.get('contenido_valor') ?? '').trim()
  let contenidoValor: number | undefined
  if (contenidoValorCrudo) {
    const valor = parsearNumero(contenidoValorCrudo)
    if (valor === null) errores.push(`"${contenidoValorCrudo}" no es un número válido en contenido_valor`)
    else if (valor < 0) errores.push('contenido_valor no puede ser negativo')
    else contenidoValor = valor
  }

  const cantidadCrudo = (valores.get('contenido_paquete_cantidad') ?? '').trim()
  let cantidadPaquete: number | undefined
  if (cantidadCrudo) {
    const valor = parsearNumero(cantidadCrudo)
    if (valor === null) errores.push(`"${cantidadCrudo}" no es un número válido en contenido_paquete_cantidad`)
    else if (valor <= 0) errores.push('contenido_paquete_cantidad debe ser mayor que cero')
    else cantidadPaquete = valor
  }

  const envaseCrudo = (valores.get('contenido_paquete_envase') ?? '').trim()

  // Misma regla que el formulario de alta y que el CHECK chk_producto_paquete_emparejado
  // de la base: la cantidad del empaque y su envase van siempre juntos.
  if (cantidadCrudo && !envaseCrudo) {
    errores.push('Falta contenido_paquete_envase: indica el envase de cada unidad del empaque')
  } else if (!cantidadCrudo && envaseCrudo) {
    errores.push('Falta contenido_paquete_cantidad: indica cuántas unidades trae el empaque')
  }

  const precioCrudo = (valores.get('precio_venta') ?? '').trim()
  let precio: string | undefined
  if (precioCrudo) {
    const valor = parsearNumero(precioCrudo)
    if (valor === null) errores.push(`"${precioCrudo}" no es un número válido en precio_venta`)
    else if (valor < 0) errores.push('precio_venta no puede ser negativo')
    else precio = valor.toFixed(2)
  }

  const descripcion = (valores.get('descripcion') ?? '').trim()

  const datos: ProductoImportable | null = errores.length || !categoriaId || !unidadId || !categoriaPaqueteId
    ? null
    : {
        fila: numero,
        nombre,
        categoria_id: categoriaId,
        unidad_medida_id: unidadId,
        categoria_paquete_id: categoriaPaqueteId,
        ...(marcaId !== null ? { marca_id: marcaId } : {}),
        ...(contenidoValor !== undefined ? { contenido_valor: contenidoValor } : {}),
        ...(cantidadPaquete !== undefined ? { contenido_paquete_cantidad: cantidadPaquete } : {}),
        ...(envaseContenidoId !== null ? { contenido_paquete_envase_id: envaseContenidoId } : {}),
        ...(precio ? { precio_venta: precio } : {}),
        ...(descripcion ? { descripcion } : {}),
      }

  return {
    numero,
    nombre: nombre || '(sin nombre)',
    categoria: (valores.get('categoria') ?? '').trim(),
    unidad: (valores.get('unidad_medida') ?? '').trim(),
    categoriaPaquete: (valores.get('categoria_paquete') ?? '').trim(),
    datos,
    errores,
  }
}

/**
 * Revisa el archivo completo: primero que existan las columnas obligatorias y
 * después, fila por fila, que los datos sean válidos. Devuelve también las
 * filas listas para mandarse al backend.
 */
export function revisarArchivo(archivo: ArchivoLeido, catalogos: Catalogos): ResultadoRevision {
  const columnas = revisarColumnas(archivo)

  // Sin las columnas obligatorias no tiene sentido validar celdas: el mapeo
  // por posición no sería confiable.
  if (columnas.faltantes.length) {
    return {
      columnas,
      filas: [],
      totalFilas: archivo.filas.length,
      excedeLimite: archivo.filas.length > MAXIMO_FILAS,
      validas: [],
      conError: [],
    }
  }

  const indices = construirIndices(catalogos)
  const indicesPorClave: Record<string, number> = {}
  for (const [clave, encabezado] of Object.entries(columnas.encontradas)) {
    indicesPorClave[clave] = archivo.encabezados.indexOf(encabezado)
  }

  const filas: FilaValidada[] = archivo.filas.slice(0, MAXIMO_FILAS).map((celdas, indice) => {
    const ordenadas = COLUMNAS_PRODUCTO.map((columna) => celdas[indicesPorClave[columna.clave]] ?? '')
    return validarFila(ordenadas, indices, indice + 2)
  })

  // Dos filas con el mismo nombre crearían productos idénticos en el catálogo.
  const vistas = new Map<string, number>()
  for (const fila of filas) {
    if (!fila.nombre || fila.nombre === '(sin nombre)') continue
    const clave = normalizarEncabezado(fila.nombre)
    const primera = vistas.get(clave)
    if (primera !== undefined) {
      fila.errores.push(`Nombre repetido: la fila ${primera} ya tiene "${fila.nombre}"`)
      fila.datos = null
    } else {
      vistas.set(clave, fila.numero)
    }
  }

  return {
    columnas,
    filas,
    totalFilas: archivo.filas.length,
    excedeLimite: archivo.filas.length > MAXIMO_FILAS,
    validas: filas.filter((fila) => !fila.errores.length),
    conError: filas.filter((fila) => fila.errores.length > 0),
  }
}
