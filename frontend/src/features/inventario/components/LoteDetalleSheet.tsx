import { ArrowDownCircle, ArrowUpCircle } from 'lucide-react'

import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

import { useHistorialProductos, type TipoMovimiento } from '../api'

const ICONO_TIPO: Record<TipoMovimiento, typeof ArrowDownCircle> = {
  ingreso: ArrowDownCircle,
  salida: ArrowUpCircle,
}

const formatoMoneda = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' })
const formatoFecha = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' })

export function LoteDetalleSheet({
  productoNombre,
  productoIds,
  open,
  onOpenChange,
}: {
  productoNombre: string
  productoIds: number[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: historial, isLoading } = useHistorialProductos(productoIds)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Historial del producto</SheetTitle>
          <SheetDescription>
            {productoNombre} · movimientos registrados en todos sus lotes.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
          {!isLoading && (!historial || historial.length === 0) && (
            <p className="text-sm text-muted-foreground">No hay movimientos para este lote.</p>
          )}
          {historial && historial.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>ID / Lote</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Cant.</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historial.map((mov) => {
                  const Icono = ICONO_TIPO[mov.tipo]
                  const esIngreso = mov.tipo === 'ingreso'
                  return (
                    <TableRow key={mov.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatoFecha.format(new Date(mov.fecha))}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {mov.lote_numero ?? 'Sin código'} · #{mov.lote_id}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Icono className={`size-4 ${esIngreso ? 'text-secondary' : mov.tipo === 'salida' ? 'text-destructive' : 'text-amber-600'}`} />
                          <div>
                            <div className="text-sm">{mov.tipo_display}</div>
                            <Badge variant="secondary" className="text-[10px]">{mov.origen_display}</Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className={`text-right font-medium ${esIngreso ? 'text-secondary' : 'text-destructive'}`}>
                        {esIngreso ? '+' : '-'}{mov.cantidad}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {mov.saldo_cantidad} · {formatoMoneda.format(mov.saldo_valorizado)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}