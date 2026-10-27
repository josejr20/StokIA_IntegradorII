import { useState } from 'react'
import { FileUp, XCircle, CheckCircle2, AlertTriangle, Download, FileSearch, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { useConfirmarKardex, usePrevisualizarKardex, type KardexPreviewResultado } from '../api'

interface ImportResult {
  total_rows: number
  created: number
  skipped: number
  errors: number
  error_details: Array<{ row?: number; presentacion?: string; reason?: string; error?: string }>
}

export function ImportarKardexModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [archivo, setArchivo] = useState<File | null>(null)
  const [previsualizando, setPrevisualizando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [preview, setPreview] = useState<KardexPreviewResultado | null>(null)
  const [resultado, setResultado] = useState<ImportResult | null>(null)

  const previsualizar = usePrevisualizarKardex()
  const confirmar = useConfirmarKardex()

  function cerrar() {
    setArchivo(null)
    setPreview(null)
    setResultado(null)
    setPrevisualizando(false)
    setConfirmando(false)
    previsualizar.reset()
    confirmar.reset()
    onOpenChange(false)
  }

  function volverASeleccion() {
    setPreview(null)
    setResultado(null)
    setArchivo(null)
    previsualizar.reset()
  }

  async function procesarArchivo(elegido: File) {
    setArchivo(elegido)
    setPreview(null)
    setResultado(null)
    setPrevisualizando(true)
    try {
      const res = await previsualizar.mutateAsync(elegido)
      setPreview(res)
    } catch (error) {
      console.error(error)
      toast.error('No se pudo leer/previsualizar el archivo')
    } finally {
      setPrevisualizando(false)
    }
  }

  async function confirmarImportacion() {
    if (!preview?.previewId) return
    setConfirmando(true)
    try {
      const res = await confirmar.mutateAsync(preview.previewId)
      setResultado(res)
      toast.success(`${res.created} operación(es) importada(s)`)
      if (res.skipped > 0) toast.warning(`${res.skipped} fila(s) omitidas`)
      if (res.errors > 0) toast.error(`${res.errors} fila(s) con error`)
    } catch (error) {
      console.error(error)
      toast.error('No se pudo confirmar la importación')
    } finally {
      setConfirmando(false)
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

  return (
    <Dialog open={open} onOpenChange={(v) => !v && cerrar()}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Importar Kardex desde Excel</DialogTitle>
          <DialogDescription>
            Sube el archivo, revisa el previsualizado y confirma para registrar en la base de datos
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          {!preview && !resultado ? (
            <div className="space-y-4">
              <label
                onDragOver={(e) => e.preventDefault()}
                onDrop={desdeSoltar}
                className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
                  previsualizando ? 'opacity-60' : 'hover:bg-muted/50'
                }`}
              >
                <FileUp className="size-10 text-muted-foreground" />
                {previsualizando ? (
                  <span className="text-sm font-medium">Leyendo y previsualizando archivo…</span>
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
                      Haz clic o arrastra aquí tu archivo Excel (.xlsx)
                    </span>
                    <span className="text-xs text-muted-foreground">
                      .xlsx · Se revisará antes de importar
                    </span>
                  </>
                )}
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="sr-only"
                  disabled={previsualizando}
                  onChange={desdeInput}
                />
              </label>

              <div className="rounded-lg border bg-amber-50 p-4 text-sm">
                <div className="flex gap-2">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                  <div className="space-y-1">
                    <p className="font-semibold">Notas importantes:</p>
                    <ul className="list-disc ml-4 space-y-0.5 text-xs">
                      <li>El archivo debe tener las columnas: N°, fcreacion, cliente, presentacion, observaciones, motivo, cantidad</li>
                      <li>Los motivos válidos son: "Ingreso por devolucion en una venta" y "Salida por generacion de pedido a venta"</li>
                      <li>Primero se previsualiza (lectura/revisión), luego se confirma para ingresar a BD</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          ) : preview && !resultado ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border bg-blue-50 p-3 text-center">
                  <Download className="size-5 text-primary mx-auto" />
                  <p className="text-xl font-bold">{preview.total}</p>
                  <p className="text-xs text-muted-foreground">Total filas</p>
                </div>
                <div className="rounded-lg border bg-green-50 p-3 text-center">
                  <CheckCircle2 className="size-5 text-secondary mx-auto" />
                  <p className="text-xl font-bold">{preview.validas}</p>
                  <p className="text-xs text-muted-foreground">A ingresar</p>
                </div>
                <div className="rounded-lg border bg-red-50 p-3 text-center">
                  <AlertTriangle className="size-5 text-destructive mx-auto" />
                  <p className="text-xl font-bold">{preview.conError}</p>
                  <p className="text-xs text-muted-foreground">Con error</p>
                </div>
                <div className="rounded-lg border bg-amber-50 p-3 text-center">
                  <FileSearch className="size-5 text-amber-600 mx-auto" />
                  <p className="text-xl font-bold">{preview.clientesNuevos.length}</p>
                  <p className="text-xs text-muted-foreground">Clientes a crear</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 text-xs">
                <span className="rounded-full bg-muted px-2 py-1">Ventas (salida): {preview.ventas}</span>
                <span className="rounded-full bg-muted px-2 py-1">Devoluciones (ingreso): {preview.devoluciones}</span>
                <span className="rounded-full bg-muted px-2 py-1">Válidas: {preview.validas}</span>
              </div>

              {preview.clientesNuevos.length > 0 && (
                <div className="rounded-lg border bg-amber-50 p-3">
                  <p className="font-semibold text-amber-800 mb-1 text-sm">Clientes que se crearán al confirmar:</p>
                  <div className="max-h-24 overflow-y-auto text-xs text-amber-900">
                    {preview.clientesNuevos.join(', ')}
                  </div>
                </div>
              )}

              {preview.productosNoMapeados.length > 0 && (
                <div className="rounded-lg border bg-red-50 p-3">
                  <p className="font-semibold text-destructive mb-1 text-sm">Presentaciones sin mapeo a producto:</p>
                  <div className="max-h-24 overflow-y-auto text-xs text-red-700">
                    {preview.productosNoMapeados.join(', ')}
                  </div>
                </div>
              )}

              <div className="rounded-lg border">
                <div className="flex items-center justify-between border-b p-2">
                  <p className="text-sm font-semibold">Previsualización (filas leídas)</p>
                  <p className="text-xs text-muted-foreground">Mostrando {preview.filas.length} fila(s)</p>
                </div>
                <div className="max-h-72 overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="p-2 text-left">Fila</th>
                        <th className="p-2 text-left">Fecha</th>
                        <th className="p-2 text-left">Cliente</th>
                        <th className="p-2 text-left">Presentación</th>
                        <th className="p-2 text-left">Motivo</th>
                        <th className="p-2 text-left">Cantidad</th>
                        <th className="p-2 text-left">Tipo</th>
                        <th className="p-2 text-left">Estado</th>
                        <th className="p-2 text-left">Detalle</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.filas.slice(0, 200).map((f, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-2">{f.fila}</td>
                          <td className="p-2">{f.fecha ? new Date(f.fecha).toLocaleDateString() : '-'}</td>
                          <td className="p-2">{f.cliente}{f.clienteNuevo ? ' (nuevo)' : ''}</td>
                          <td className="p-2 max-w-[220px] truncate" title={f.presentacion}>{f.presentacion}</td>
                          <td className="p-2 max-w-[160px] truncate" title={f.motivo}>{f.motivo}</td>
                          <td className="p-2">{f.cantidad}</td>
                          <td className="p-2">{f.tipo || '-'}</td>
                          <td className="p-2">{f.estado === 'OK' ? 'OK' : 'ERROR'}</td>
                          <td className="p-2 max-w-[200px] truncate" title={f.errores.join('; ')}>{f.errores.join('; ') || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {preview.filas.length > 200 && (
                    <p className="p-2 text-xs text-muted-foreground">Mostrando solo primeras 200 filas en la previsualización.</p>
                  )}
                </div>
              </div>
            </div>
          ) : resultado ? (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="rounded-lg border bg-green-50 p-4 text-center">
                  <CheckCircle2 className="size-6 text-secondary mx-auto" />
                  <p className="text-2xl font-bold">{resultado.created}</p>
                  <p className="text-xs text-muted-foreground">Creadas</p>
                </div>
                <div className="rounded-lg border bg-amber-50 p-4 text-center">
                  <XCircle className="size-6 text-amber-600 mx-auto" />
                  <p className="text-2xl font-bold">{resultado.skipped}</p>
                  <p className="text-xs text-muted-foreground">Omitidas</p>
                </div>
                <div className="rounded-lg border bg-red-50 p-4 text-center">
                  <AlertTriangle className="size-6 text-destructive mx-auto" />
                  <p className="text-2xl font-bold">{resultado.errors}</p>
                  <p className="text-xs text-muted-foreground">Errores</p>
                </div>
                <div className="rounded-lg border bg-blue-50 p-4 text-center">
                  <Download className="size-6 text-primary mx-auto" />
                  <p className="text-2xl font-bold">{resultado.total_rows}</p>
                  <p className="text-xs text-muted-foreground">Total filas</p>
                </div>
              </div>

              {resultado.error_details.length > 0 && (
                <div className="rounded-lg border bg-red-50 p-4">
                  <p className="font-semibold text-destructive mb-2">Detalles de errores/omisiones (primeros 50):</p>
                  <div className="max-h-64 overflow-y-auto space-y-1 text-xs">
                    {resultado.error_details.map((err, i) => (
                      <div key={i} className="font-mono text-red-700">
                        Fila {err.row}: {err.presentacion || ''} {err.reason || err.error || 'Error desconocido'}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button variant="outline" onClick={cerrar} className="w-full">
                Cerrar
              </Button>
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {!preview && !resultado && !archivo && (
            <Button variant="ghost" onClick={cerrar}>Cancelar</Button>
          )}
          {!preview && !resultado && archivo && !previsualizando && (
            <Button variant="outline" onClick={volverASeleccion}>Seleccionar otro archivo</Button>
          )}
          {preview && !resultado && (
            <>
              <Button variant="outline" onClick={volverASeleccion} disabled={confirmando}>
                <ArrowLeft className="mr-2 size-4" /> Volver
              </Button>
              <Button onClick={confirmarImportacion} disabled={confirmando || preview.validas === 0}>
                {confirmando ? 'Confirmando e importando...' : `Confirmar e ingresar ${preview.validas} fila(s) a BD`}
              </Button>
            </>
          )}
          {resultado && (
            <Button variant="outline" onClick={cerrar}>Cerrar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}