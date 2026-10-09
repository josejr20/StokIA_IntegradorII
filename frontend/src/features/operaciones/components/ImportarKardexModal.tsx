import { useState } from 'react'
import { FileUp, XCircle, CheckCircle2, AlertTriangle, Download } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { api } from '@/lib/api'

interface ImportResult {
  total_rows: number
  created: number
  skipped: number
  errors: number
  error_details: Array<{ row?: number; presentacion?: string; reason?: string; error?: string }>
}

export function ImportarKardexModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [archivo, setArchivo] = useState<File | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [resultado, setResultado] = useState<ImportResult | null>(null)
  const [leyendo, setLeyendo] = useState(false)

  function cerrar() {
    setArchivo(null)
    setResultado(null)
    setSubiendo(false)
    setLeyendo(false)
    onOpenChange(false)
  }

  async function procesarArchivo(elegido: File) {
    setArchivo(elegido)
    setResultado(null)
    setLeyendo(true)
    
    setSubiendo(true)
    try {
      const formData = new FormData()
      formData.append('archivo', elegido)
      const respuesta = await api.postForm<{ data: ImportResult }>('/importar-kardex/kardex', formData)
      setResultado(respuesta.data)
      toast.success(`${respuesta.data.created} operación(es) importada(s)`)
      if (respuesta.data.skipped > 0) {
        toast.warning(`${respuesta.data.skipped} fila(s) omitidas`)
      }
      if (respuesta.data.errors > 0) {
        toast.error(`${respuesta.data.errors} fila(s) con error`)
      }
    } catch (error) {
      console.error(error)
      toast.error('No se pudo importar el archivo')
    } finally {
      setSubiendo(false)
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

  return (
    <Dialog open={open} onOpenChange={(v) => !v && cerrar()}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar Kardex desde Excel</DialogTitle>
          <DialogDescription>
            Sube el archivo kardex_presentaciones.xlsx para registrar las operaciones históricas
            (entradas por devolución, salidas por venta) con sus fechas, clientes,
            presentaciones, observaciones y motivos.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          {!resultado ? (
            <div className="space-y-4">
              <label
                onDragOver={(e) => e.preventDefault()}
                onDrop={desdeSoltar}
                className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
                  subiendo || leyendo ? 'opacity-60' : 'hover:bg-muted/50'
                }`}
              >
                <FileUp className="size-10 text-muted-foreground" />
                {leyendo ? (
                  <span className="text-sm font-medium">Leyendo el archivo…</span>
                ) : subiendo ? (
                  <span className="text-sm font-medium">Importando operaciones…</span>
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
                      .xlsx · hasta 2000 filas
                    </span>
                  </>
                )}
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="sr-only"
                  disabled={subiendo || leyendo}
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
                      <li>Las cantidades negativas en salidas se convierten a positivas automáticamente</li>
                      <li>Si falta stock para una salida histórica, se registra como apertura inicial únicamente la cantidad faltante</li>
                      <li>Se crean clientes nuevos si no existen</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          ) : (
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
          )}
        </div>

        <DialogFooter>
          {!resultado && !archivo && (
            <>
              <Button variant="ghost" onClick={cerrar}>
                Cancelar
              </Button>
            </>
          )}
          {resultado && (
            <Button variant="outline" onClick={cerrar}>
              Cerrar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}