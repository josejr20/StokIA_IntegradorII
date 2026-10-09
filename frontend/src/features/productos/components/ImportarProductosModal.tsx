import { useMemo, useState } from 'react'
import {
  AlertTriangle, CheckCircle2, FileSpreadsheet, FileUp, ShieldAlert, Upload, XCircle,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { ApiError } from '@/lib/api'

import { useCategorias, useImportarProductos, useMarcas, useTiposEnvase, useUnidadesMedida } from '../api'
import { COLUMNAS_PRODUCTO, FORMATOS_ARCHIVO, encabezadosCsv, type FormatoArchivo } from '../importacion/campos'
import { leerArchivo, type ArchivoLeido } from '../importacion/parseo'
import { MAXIMO_FILAS, revisarArchivo, type ResultadoRevision } from '../importacion/validacion'

type Paso = 'formato' | 'archivo' | 'revision' | 'confirmacion' | 'resultado'

const TITULOS: Record<Paso, string> = {
  formato: 'Cargar productos desde archivo',
  archivo: 'Selecciona el archivo',
  revision: 'Revisa lo que se va a cargar',
  confirmacion: 'Confirmar carga',
  resultado: 'Carga terminada',
}

const DESCRIPCIONES: Record<Paso, string> = {
  formato: 'Elige el formato del archivo y revisa qué columnas necesita antes de subirlo.',
  archivo: 'Sube el archivo con hasta 500 productos. Todavía no se guarda nada.',
  revision: 'Verificamos que el archivo tenga las columnas y los datos correctos.',
  confirmacion: 'Revisa el resumen una última vez antes de escribir en la base de datos.',
  resultado: 'Los productos ya están en el catálogo.',
}

/**
 * Carga masiva de productos desde CSV o Excel, con los mismos campos y reglas
 * que el alta uno por uno (components/NuevoProductoModal.tsx).
 *
 *   1. formato   -> 2. archivo -> 3. revisión de columnas y datos
 *      -> 4. doble confirmación -> 5. resultado
 *
 * La revisión (paso 3) se hace en el navegador contra los mismos catálogos que
 * usa el formulario, así que el usuario ve los errores exactos antes de tocar la
 * base. El backend vuelve a validar todo e inserta en una sola transacción.
 */
export function ImportarProductosModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [paso, setPaso] = useState<Paso>('formato')
  const [confirmacion, setConfirmacion] = useState<1 | 2>(1)
  const [formato, setFormato] = useState<FormatoArchivo>('csv')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [leido, setLeido] = useState<ArchivoLeido | null>(null)
  const [omitirConError, setOmitirConError] = useState(true)
  const [falloCarga, setFalloCarga] = useState<string[]>([])
  const [creados, setCreados] = useState<{ total: number; codigos: string[] } | null>(null)
  const [leyendo, setLeyendo] = useState(false)

  const { data: categorias } = useCategorias()
  const { data: unidades } = useUnidadesMedida()
  const { data: marcas } = useMarcas()
  const { data: tiposEnvase } = useTiposEnvase()
  const importar = useImportarProductos()

  const hayCatalogos = Boolean(categorias?.results.length && unidades?.results.length && tiposEnvase?.results.length)

  // La revisión se deriva en render en vez de guardarse en estado: los catálogos
  // llegan por API y pueden terminar de cargarse después que el archivo.
  const revision = useMemo(() => {
    if (!leido || !hayCatalogos) return null
    return revisarArchivo(leido, {
      categorias: categorias?.results ?? [],
      unidades: unidades?.results ?? [],
      marcas: marcas?.results ?? [],
      tiposEnvase: tiposEnvase?.results ?? [],
    })
  }, [leido, hayCatalogos, categorias, unidades, marcas, tiposEnvase])

  // Al cerrar se reinicia todo, para que la próxima apertura arranque en el paso 1.
  function cerrar() {
    setPaso('formato')
    setConfirmacion(1)
    setFormato('csv')
    setArchivo(null)
    setLeido(null)
    setOmitirConError(true)
    setFalloCarga([])
    setCreados(null)
    setLeyendo(false)
    onOpenChange(false)
  }

  function cambiarFormato(nuevo: FormatoArchivo) {
    if (nuevo === formato) return
    setFormato(nuevo)
    setArchivo(null)
    setLeido(null)
    setFalloCarga([])
  }

  async function procesarArchivo(elegido: File) {
    setArchivo(elegido)
    setLeido(null)
    setFalloCarga([])
    setLeyendo(true)
    try {
      setLeido(await leerArchivo(elegido, formato))
      setPaso('revision')
    } catch (error) {
      setArchivo(null)
      toast.error(error instanceof Error ? error.message : 'No se pudo leer el archivo')
    } finally {
      setLeyendo(false)
    }
  }

  function desdeInput(evento: React.ChangeEvent<HTMLInputElement>) {
    const elegido = evento.target.files?.[0]
    evento.target.value = ''
    if (elegido) void procesarArchivo(elegido)
  }

  function desdeSoltar(evento: React.DragEvent<HTMLLabelElement>) {
    evento.preventDefault()
    const elegido = evento.dataTransfer.files?.[0]
    if (elegido) void procesarArchivo(elegido)
  }

  const columnasListas = Boolean(revision && !revision.columnas.faltantes.length)
  const puedeCargar = columnasListas
    && !revision?.excedeLimite
    && revision !== null
    && revision.validas.length > 0
    && (omitirConError || revision.conError.length === 0)

  async function confirmarCarga() {
    const datos = (revision?.validas ?? []).map((fila) => fila.datos).filter((dato) => dato !== null)
    if (!datos.length) return
    setFalloCarga([])
    try {
      const respuesta = await importar.mutateAsync(datos)
      setCreados({ total: respuesta.data.creados, codigos: respuesta.data.codigos })
      setPaso('resultado')
      toast.success(`${respuesta.data.creados} producto(s) cargados`)
    } catch (error) {
      const mensajes = error instanceof ApiError
        ? [error.message, ...detallesDeApi(error)]
        : ['No se pudo cargar los productos']
      setFalloCarga(mensajes)
      setPaso('revision')
      toast.error(mensajes[0])
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && cerrar()}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{TITULOS[paso]}</DialogTitle>
          <DialogDescription>{DESCRIPCIONES[paso]}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          {paso === 'formato' && (
            <PasoFormato formato={formato} onCambiar={cambiarFormato} />
          )}

          {paso === 'archivo' && (
            <PasoArchivo
              formato={formato}
              archivo={archivo}
              leyendo={leyendo}
              onInput={desdeInput}
              onSoltar={desdeSoltar}
            />
          )}

          {paso === 'revision' && (
            <PasoRevision
              nombreArchivo={archivo?.name ?? ''}
              revision={revision}
              hayCatalogos={hayCatalogos}
              omitirConError={omitirConError}
              onOmitir={setOmitirConError}
              falloCarga={falloCarga}
            />
          )}

          {paso === 'confirmacion' && (
            <PasoConfirmacion
              paso={confirmacion}
              archivo={archivo?.name ?? ''}
              cantidad={revision?.validas.length ?? 0}
              omitidas={revision?.conError.length ?? 0}
              cargando={importar.isPending}
            />
          )}

          {paso === 'resultado' && <PasoResultado archivo={archivo?.name ?? ''} creados={creados} />}
        </div>

        <DialogFooter>
          {paso === 'formato' && (
            <>
              <Button variant="outline" onClick={cerrar}>Cancelar</Button>
              <Button onClick={() => setPaso('archivo')}>Continuar</Button>
            </>
          )}

          {paso === 'archivo' && (
            <>
              <Button variant="outline" onClick={() => setPaso('formato')}>Atrás</Button>
              <Button variant="ghost" onClick={cerrar}>Cancelar</Button>
            </>
          )}

          {paso === 'revision' && (
            <>
              <Button variant="outline" onClick={() => { setArchivo(null); setLeido(null); setPaso('archivo') }}>
                Cambiar archivo
              </Button>
              <Button
                disabled={!puedeCargar}
                onClick={() => { setConfirmacion(1); setPaso('confirmacion') }}
              >
                Revisar y confirmar
              </Button>
            </>
          )}

          {paso === 'confirmacion' && confirmacion === 1 && (
            <>
              <Button variant="outline" onClick={() => setPaso('revision')}>Volver al archivo</Button>
              <Button onClick={() => setConfirmacion(2)}>Continuar</Button>
            </>
          )}

          {paso === 'confirmacion' && confirmacion === 2 && (
            <>
              <Button variant="outline" onClick={() => setConfirmacion(1)} disabled={importar.isPending}>
                Atrás
              </Button>
              <Button onClick={confirmarCarga} disabled={importar.isPending}>
                <Upload className="size-4" />
                {importar.isPending
                  ? 'Cargando…'
                  : `Sí, cargar ${revision?.validas.length ?? 0} producto(s)`}
              </Button>
            </>
          )}

          {paso === 'resultado' && <Button onClick={cerrar}>Listo</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Detalle por fila que el backend devuelve en el 400 de la importación. */
function detallesDeApi(error: ApiError): string[] {
  const cuerpo = error.body
  if (!cuerpo || typeof cuerpo !== 'object') return []
  const detalles = (cuerpo as Record<string, unknown>).details
  if (!Array.isArray(detalles)) return []
  return detalles.slice(0, 5).map((detalle) => {
    const item = detalle as Record<string, unknown>
    return `Fila ${item.fila ?? '?'}: ${item.msg ?? 'dato inválido'}`
  })
}

// ------------------------------------------------------------------ paso 1

function PasoFormato({ formato, onCambiar }: { formato: FormatoArchivo; onCambiar: (f: FormatoArchivo) => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {FORMATOS_ARCHIVO.map((opcion) => {
          const activo = opcion.valor === formato
          return (
            <button
              key={opcion.valor}
              type="button"
              onClick={() => onCambiar(opcion.valor)}
              className={`flex items-start gap-3 rounded-lg border p-4 text-left transition-colors ${
                activo ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
              }`}
            >
              <FileSpreadsheet
                className={`mt-0.5 size-5 shrink-0 ${activo ? 'text-primary' : 'text-muted-foreground'}`}
              />
              <span className="space-y-1">
                <span className="block font-medium">{opcion.etiqueta}</span>
                <span className="block text-xs text-muted-foreground">{opcion.descripcion}</span>
              </span>
            </button>
          )
        })}
      </div>

      {formato === 'csv' ? <EstructuraCsv /> : <EstructuraExcel />}
    </div>
  )
}

/** CSV: solo la línea de encabezados que debe traer la primera fila. */
function EstructuraCsv() {
  return (
    <div className="rounded-lg border">
      <div className="border-b p-4">
        <h3 className="text-sm font-semibold">Estructura del CSV</h3>
        <p className="text-xs text-muted-foreground">
          La primera fila debe traer estos encabezados, separados por coma y en este orden.
        </p>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-xs">
        <code>{encabezadosCsv()}</code>
      </pre>
    </div>
  )
}

/** Excel: tabla con los encabezados que debe traer la primera fila. */
function EstructuraExcel() {
  return (
    <div className="rounded-lg border">
      <div className="border-b p-4">
        <h3 className="text-sm font-semibold">Columnas que debe tener el Excel</h3>
        <p className="text-xs text-muted-foreground">
          La primera fila debe traer estos encabezados, en este orden.
        </p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            {COLUMNAS_PRODUCTO.map((columna) => (
              <TableHead
                key={columna.clave}
                className="whitespace-nowrap font-mono text-xs normal-case"
              >
                {columna.etiqueta}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
      </Table>
    </div>
  )
}

// ------------------------------------------------------------------ paso 2

function PasoArchivo({
  formato,
  archivo,
  leyendo,
  onInput,
  onSoltar,
}: {
  formato: FormatoArchivo
  archivo: File | null
  leyendo: boolean
  onInput: (evento: React.ChangeEvent<HTMLInputElement>) => void
  onSoltar: (evento: React.DragEvent<HTMLLabelElement>) => void
}) {
  const acceptance = FORMATOS_ARCHIVO.find((f) => f.valor === formato)?.acept ?? '.csv'
  const extension = formato === 'csv' ? '.csv' : '.xlsx'

  return (
    <div className="space-y-4">
      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={onSoltar}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
          leyendo ? 'opacity-60' : 'hover:bg-muted/50'
        }`}
      >
        <FileUp className="size-10 text-muted-foreground" />
        {leyendo ? (
          <span className="text-sm font-medium">Leyendo el archivo…</span>
        ) : archivo ? (
          <>
            <span className="text-sm font-medium">{archivo.name}</span>
            <span className="text-xs text-muted-foreground">
              {(archivo.size / 1024).toFixed(0)} KB - haz clic para elegir otro
            </span>
          </>
        ) : (
          <>
            <span className="text-sm font-medium">
              Haz clic o arrastra aquí tu archivo {formato === 'csv' ? 'CSV' : 'Excel'}
            </span>
            <span className="text-xs text-muted-foreground">
              {extension} · hasta {MAXIMO_FILAS} productos
            </span>
          </>
        )}
        <input
          type="file"
          accept={acceptance}
          className="sr-only"
          disabled={leyendo}
          onChange={onInput}
        />
      </label>
    </div>
  )
}

// ------------------------------------------------------------------ paso 3

function PasoRevision({
  nombreArchivo,
  revision,
  hayCatalogos,
  omitirConError,
  onOmitir,
  falloCarga,
}: {
  nombreArchivo: string
  revision: ResultadoRevision | null
  hayCatalogos: boolean
  omitirConError: boolean
  onOmitir: (valor: boolean) => void
  falloCarga: string[]
}) {
  if (!hayCatalogos) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Cargando catálogos…</p>
  }
  if (!revision) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Revisando el archivo…</p>
  }

  const { columnas, filas, totalFilas, excedeLimite, validas, conError } = revision

  return (
    <div className="space-y-4">
      {falloCarga.length > 0 && (
        <Alerta tipo="error" titulo="La carga no se pudo completar">
          <ul className="space-y-0.5">
            {falloCarga.map((mensaje) => <li key={mensaje}>{mensaje}</li>)}
          </ul>
          <p className="mt-1">No se guardó ningún producto.</p>
        </Alerta>
      )}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">{nombreArchivo}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">{totalFilas} fila(s)</span>
        <span className="text-muted-foreground">·</span>
        <span className="inline-flex items-center gap-1 text-secondary">
          <CheckCircle2 className="size-4" /> {validas.length} lista(s)
        </span>
        {conError.length > 0 && (
          <>
            <span className="text-muted-foreground">·</span>
            <span className="inline-flex items-center gap-1 text-destructive">
              <XCircle className="size-4" /> {conError.length} con problema(s)
            </span>
          </>
        )}
      </div>

      {columnas.faltantes.length > 0 && (
        <Alerta tipo="error" titulo={`Faltan ${columnas.faltantes.length} columna(s) obligatorias`}>
          <p>El archivo no se puede leer hasta que las agregues:</p>
          <ul className="mt-1 space-y-0.5">
            {columnas.faltantes.map((columna) => (
              <li key={columna.clave}>
                <code className="font-mono font-semibold">{columna.etiqueta}</code> - {columna.ayuda}
              </li>
            ))}
          </ul>
        </Alerta>
      )}

      {excedeLimite && (
        <Alerta tipo="error" titulo={`El archivo supera el máximo de ${MAXIMO_FILAS} productos`}>
          Tiene {totalFilas} filas. Divídelo en varios archivos de hasta {MAXIMO_FILAS} e impórtalos por partes.
        </Alerta>
      )}

      {columnas.duplicadas.length > 0 && (
        <Alerta tipo="aviso" titulo="Hay columnas repetidas">
          Se tomó la primera aparición de: {columnas.duplicadas.join(', ')}.
        </Alerta>
      )}

      {columnas.ignoradas.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Se ignorarán estas columnas porque no son parte de la ficha del producto:{' '}
          {columnas.ignoradas.join(', ')}.
        </p>
      )}

      {columnas.faltantes.length === 0 && conError.length > 0 && (
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
          <input
            type="checkbox"
            checked={omitirConError}
            onChange={(e) => onOmitir(e.target.checked)}
            className="mt-0.5 size-4 accent-primary"
          />
          <span className="text-sm">
            Cargar solo las {validas.length} fila(s) correctas y dejar fuera las {conError.length} con problema(s).
            <span className="block text-xs text-muted-foreground">
              Desmárcalo para no cargar nada hasta que arregles el archivo.
            </span>
          </span>
        </label>
      )}

      {columnas.faltantes.length === 0 && conError.length > 0 && (
        <Alerta tipo="aviso" titulo={`${conError.length} fila(s) necesitan corrección`}>
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {conError.map((fila) => (
              <li key={fila.numero}>
                <strong className="text-xs">Fila {fila.numero}</strong>
                {fila.nombre !== '(sin nombre)' && <> · {fila.nombre}</>}
                <ul className="ml-3 list-disc text-destructive">
                  {fila.errores.map((error) => <li key={error}>{error}</li>)}
                </ul>
              </li>
            ))}
          </ul>
        </Alerta>
      )}

      {columnas.faltantes.length === 0 && filas.length === 0 && (
        <Alerta tipo="error" titulo="El archivo no tiene filas de datos">
          Agrega al menos un producto debajo de la fila de encabezados.
        </Alerta>
      )}

      {validas.length > 0 && <TablaMuestra filas={validas} />}
    </div>
  )
}

function TablaMuestra({ filas }: { filas: ResultadoRevision['validas'] }) {
  return (
    <div className="rounded-lg border">
      <p className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">
        Así se van a registrar las {filas.length} fila(s)
      </p>
      <div className="max-h-[50vh] overflow-y-auto">
        <Table contenedorClassName="overflow-visible">
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              <TableHead className="bg-background">Fila</TableHead>
              <TableHead className="bg-background">Nombre</TableHead>
              <TableHead className="bg-background">Categoría</TableHead>
              <TableHead className="bg-background">Unidad</TableHead>
              <TableHead className="bg-background">Empaque</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.map((fila) => (
              <TableRow key={fila.numero}>
                <TableCell className="text-muted-foreground">{fila.numero}</TableCell>
                <TableCell className="font-medium">{fila.nombre}</TableCell>
                <TableCell>{fila.categoria || '-'}</TableCell>
                <TableCell>{fila.unidad || '-'}</TableCell>
                <TableCell>{fila.categoriaPaquete || '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ paso 4

function PasoConfirmacion({
  paso,
  archivo,
  cantidad,
  omitidas,
  cargando,
}: {
  paso: 1 | 2
  archivo: string
  cantidad: number
  omitidas: number
  cargando: boolean
}) {
  if (paso === 1) {
    return (
      <Alerta tipo="aviso" titulo="Se van a crear productos nuevos en el catálogo">
        <ul className="mt-1 space-y-1 text-sm">
          <li>· <strong>{cantidad}</strong> producto(s) nuevo(s) desde <em>{archivo}</em>.</li>
          {omitidas > 0 && <li>· {omitidas} fila(s) con problemas quedarán fuera de la carga.</li>}
          <li>· El código de cada producto (P-001, P-002…) lo genera el sistema.</li>
          <li>· Quedarán activos y sin stock: el stock se registra después con lotes.</li>
          <li>· La carga es de un solo golpe: si algo falla no se guarda ningún producto.</li>
        </ul>
      </Alerta>
    )
  }

  return (
    <div className="space-y-3">
      <div className="grid size-12 place-items-center rounded-full bg-amber-100">
        <ShieldAlert className="size-6 text-amber-600" />
      </div>
      <Alerta tipo="aviso" titulo={`¿Confirmas la carga de ${cantidad} producto(s)?`}>
        <p>
          Los códigos se asignarán de corrido y los productos aparecerán de inmediato en el catálogo.
          La acción no se puede deshacer: para revertirla hay que desactivar cada producto.
        </p>
      </Alerta>
      {cargando && (
        <p className="text-sm text-muted-foreground">
          Guardando {cantidad} producto(s) en una sola transacción…
        </p>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ paso 5

function PasoResultado({
  archivo,
  creados,
}: {
  archivo: string
  creados: { total: number; codigos: string[] } | null
}) {
  return (
    <div className="space-y-3">
      <div className="grid size-12 place-items-center rounded-full bg-green-100">
        <CheckCircle2 className="size-6 text-secondary" />
      </div>
      <Alerta tipo="exito" titulo={`${creados?.total ?? 0} producto(s) cargados desde ${archivo}`}>
        <p>Ya están disponibles en el catálogo y se les generó el código automáticamente.</p>
        {creados && creados.codigos.length > 0 && (
          <p className="mt-2 font-mono text-xs">
            {creados.codigos.slice(0, 12).join(' · ')}
            {creados.codigos.length > 12 && ` · +${creados.codigos.length - 12} más`}
          </p>
        )}
      </Alerta>
    </div>
  )
}

// ------------------------------------------------------------------ auxiliar

function Alerta({
  tipo,
  titulo,
  children,
}: {
  tipo: 'error' | 'aviso' | 'exito'
  titulo: string
  children: React.ReactNode
}) {
  const estilos = {
    error: 'border-destructive/30 bg-red-50',
    aviso: 'border-amber-300 bg-amber-50',
    exito: 'border-secondary/30 bg-green-50',
  }
  const esError = tipo === 'error'
  const esExito = tipo === 'exito'
  const Icono = esExito ? CheckCircle2 : AlertTriangle
  const colorIcono = esExito ? 'text-secondary' : esError ? 'text-destructive' : 'text-amber-600'

  return (
    <div className={`rounded-lg border p-3 ${estilos[tipo]}`}>
      <div className="flex gap-2">
        <Icono className={`mt-0.5 size-4 shrink-0 ${colorIcono}`} />
        <div className="min-w-0 space-y-1 text-sm">
          <p className="font-semibold">{titulo}</p>
          <div className="text-xs opacity-90">{children}</div>
        </div>
      </div>
    </div>
  )
}
