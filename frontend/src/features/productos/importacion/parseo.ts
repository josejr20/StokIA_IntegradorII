import { type FormatoArchivo } from './campos'

export interface ArchivoLeido {
  /** Encabezados tal como vienen en el archivo, ya sin espacios sobrantes. */
  encabezados: string[]
  /** Filas de datos, sin la de encabezados. */
  filas: string[][]
  /** Cuántas filas se descartaron por estar completamente vacías. */
  filasVacias: number
}

const TAMANIO_MAXIMO = 5 * 1024 * 1024

/** Convierte cualquier celda de la hoja a texto recortado. */
function celdaATexto(valor: unknown): string {
  if (valor === null || valor === undefined) return ''
  if (typeof valor === 'string') return valor.trim()
  if (valor instanceof Date) return valor.toISOString().slice(0, 10)
  if (typeof valor === 'number') return Number.isFinite(valor) ? String(valor) : ''
  return String(valor).trim()
}

function aTexto(matriz: unknown[][]): { filas: string[][]; filasVacias: number } {
  const filas: string[][] = []
  let filasVacias = 0
  for (const fila of matriz) {
    const celdas = (fila as unknown[]).map(celdaATexto)
    if (celdas.every((celda) => celda === '')) {
      filasVacias += 1
      continue
    }
    filas.push(celdas)
  }
  return { filas, filasVacias }
}

// Las dos librerías de lectura se cargan solo cuando el usuario elige un
// archivo: son ~110 kB que no hacen falta para el resto de la aplicación.
async function leerCsv(texto: string): Promise<string[][]> {
  const { default: Papa } = await import('papaparse')
  const resultado = Papa.parse<string[]>(texto, {
    header: false,
    // Todo se trata como texto: el precio "12,50" y el contenido "80" se
    // convierten con `parsearNumero`, no con el tipado automático de la librería.
    dynamicTyping: false,
    skipEmptyLines: 'greedy',
  })
  if (resultado.errors.length) {
    const detalle = resultado.errors[0]
    throw new Error(`No se pudo leer el CSV: ${detalle.message} (línea ${(detalle.row ?? 0) + 1})`)
  }
  return resultado.data
}

async function leerExcel(archivo: File): Promise<unknown[][]> {
  const { readSheet } = await import('read-excel-file/browser')
  try {
    return await readSheet(archivo)
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error)
    if (/password|encrypted/i.test(mensaje)) {
      throw new Error('El archivo de Excel está protegido con contraseña. Quítale la contraseña y vuelve a exportarlo.')
    }
    throw new Error(
      'No se pudo leer el archivo de Excel. Verifica que sea un .xlsx (no un .xls antiguo) y que no tenga hojas protegidas.',
    )
  }
}

/** Separa la fila de encabezados de las filas de datos. */
function separarEncabezados(filas: string[][], filasVacias: number): ArchivoLeido {
  if (!filas.length) {
    throw new Error('El archivo está vacío. Agrega una fila de encabezados y al menos un producto.')
  }
  const [encabezados, ...resto] = filas
  const utiles = encabezados.map((encabezado, indice) => encabezado || `columna_${indice + 1}`)
  return { encabezados: utiles, filas: resto, filasVacias }
}

/**
 * Lee el archivo elegido por el usuario y devuelve la matriz de celdas en
 * texto. No valida nada: de eso se encarga `revisarArchivo`.
 */
export async function leerArchivo(archivo: File, formato: FormatoArchivo): Promise<ArchivoLeido> {
  if (archivo.size > TAMANIO_MAXIMO) {
    throw new Error('El archivo supera los 5 MB. Divídelo en varios archivos más pequeños.')
  }
  if (archivo.size === 0) {
    throw new Error('El archivo está vacío.')
  }

  const extension = archivo.name.toLowerCase().split('.').pop() ?? ''
  if (extension === 'xls') {
    throw new Error('Excel antiguo (.xls) no es compatible. Ábrelo en Excel y guárdalo como .xlsx.')
  }

  if (formato === 'csv') {
    const texto = await archivo.text()
    const { filas, filasVacias } = aTexto(await leerCsv(texto))
    return separarEncabezados(filas, filasVacias)
  }

  const { filas, filasVacias } = aTexto(await leerExcel(archivo))
  return separarEncabezados(filas, filasVacias)
}
