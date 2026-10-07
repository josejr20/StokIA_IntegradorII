import { useState } from 'react'
import { FileUp } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { ApiError } from '@/lib/api'

import { useImportarVentas, type ResultadoImportacionVenta } from './api'

export function ImportarVentasModal({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [archivo, setArchivo] = useState<File | null>(null)
  const [resultado, setResultado] = useState<ResultadoImportacionVenta | null>(null)
  const importar = useImportarVentas()

  function cerrar() {
    setArchivo(null)
    setResultado(null)
    importar.reset()
    onOpenChange(false)
  }

  async function confirmar() {
    if (!archivo) return
    try {
      const respuesta = await importar.mutateAsync(archivo)
      setResultado(respuesta)
      toast.success(`${respuesta.procesadas} venta(s) importada(s)`)
      if (respuesta.rechazadas) toast.warning(`${respuesta.rechazadas} fila(s) rechazada(s)`)
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'No se pudo importar el archivo')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(valor) => !valor && cerrar()}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar historial de ventas</DialogTitle>
          <DialogDescription>
            Carga hasta 500 filas desde CSV o Excel. Las ventas históricas no modifican el stock actual.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
          <p className="text-sm text-muted-foreground">
            Columnas requeridas: <code>codigo_producto</code>, <code>cantidad</code>,{' '}
            <code>precio_unitario</code> y <code>fecha_venta</code>.
          </p>
          <a
            className="text-sm font-medium text-primary underline underline-offset-4"
            href="/plantilla-importacion-ventas.csv"
            download
          >
            Descargar plantilla CSV
          </a>

          {!resultado && (
            <label className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed p-8 text-center hover:bg-muted/50">
              <FileUp className="size-8 text-muted-foreground" />
              <span className="text-sm">{archivo?.name ?? 'Selecciona un archivo CSV o Excel'}</span>
              <input
                className="sr-only"
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(evento) => {
                  setArchivo(evento.target.files?.[0] ?? null)
                  evento.target.value = ''
                }}
              />
            </label>
          )}

          {resultado && (
            <>
              <div className="grid grid-cols-3 gap-3 text-center text-sm">
                <div className="rounded-lg border p-3"><strong className="block text-lg">{resultado.total}</strong>Total</div>
                <div className="rounded-lg border p-3"><strong className="block text-lg">{resultado.procesadas}</strong>Procesadas</div>
                <div className="rounded-lg border p-3"><strong className="block text-lg">{resultado.rechazadas}</strong>Rechazadas</div>
              </div>
              {resultado.errores.length > 0 && (
                <div className="max-h-64 overflow-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fila</TableHead>
                        <TableHead>Código</TableHead>
                        <TableHead>Motivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resultado.errores.map((error) => (
                        <TableRow key={`${error.fila}-${error.codigo}`}>
                          <TableCell>{error.fila}</TableCell>
                          <TableCell>{error.codigo || '—'}</TableCell>
                          <TableCell>{error.motivo}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={cerrar} disabled={importar.isPending}>
            {resultado ? 'Cerrar' : 'Cancelar'}
          </Button>
          {!resultado && (
            <Button onClick={() => void confirmar()} disabled={!archivo || importar.isPending}>
              {importar.isPending ? 'Importando…' : 'Importar'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
