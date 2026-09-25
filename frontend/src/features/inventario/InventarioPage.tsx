import { useState } from 'react'
import {
  Search, Plus, ChevronLeft, ChevronRight, Eye, PackagePlus,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import { useProductos } from '@/features/productos/api'
import { useLotes, type Lote } from './api'
import { NuevoLoteModal } from './components/NuevoLoteModal'
import { LoteDetalleSheet } from './components/LoteDetalleSheet'
import { RegistrarMovimientoModal } from './components/RegistrarMovimientoModal'

const formatoFecha = new Intl.DateTimeFormat('es-PE', { dateStyle: 'short' })

type BadgeVariante = 'default' | 'secondary' | 'outline' | 'alto' | 'medio' | 'bajo'

const HOY = new Date()
const HORA_DIA = 1000 * 60 * 60 * 24

function estadoLote(
  fechaVencimiento: string,
  cantidadActual: number,
): { texto: string; variante: BadgeVariante } {
  if (cantidadActual <= 0) return { texto: 'Agotado', variante: 'secondary' }
  const diff = Math.ceil((new Date(fechaVencimiento).getTime() - HOY.getTime()) / HORA_DIA)
  if (diff < 0) return { texto: 'Vencido', variante: 'alto' }
  if (diff <= 7) return { texto: 'Próximo a vencer', variante: 'medio' }
  return { texto: 'Vigente', variante: 'bajo' }
}

function aNumero(v: number | string | null | undefined): number {
  return Number(v ?? 0)
}

export default function InventarioPage() {
  const [busqueda, setBusqueda] = useState('')
  const [productoId, setProductoId] = useState('')
  const [pageSize, setPageSize] = useState(10)
  const [pagina, setPagina] = useState(1)

  const [modalNuevo, setModalNuevo] = useState(false)
  const [loteDetalle, setLoteDetalle] = useState<Lote | null>(null)
  const [loteMovimiento, setLoteMovimiento] = useState<Lote | null>(null)

  const { data: productos } = useProductos({})
  const { data, isLoading } = useLotes({
    search: busqueda,
    producto: productoId,
    page: pagina,
    pageSize,
  })

  const productoSeleccionado = productos?.results.find(
    (p) => String(p.id) === productoId,
  )

  function codigoDelLote(lote: Lote): string {
    return productos?.results.find((p) => p.id === lote.producto_id)?.codigo ?? ''
  }

  const lotes = data?.results ?? []

  return (
    <div className="space-y-6">
      {/* Toolbar: HU06 — buscar/filtrar lotes por producto y lote + crear lote */}
      <div className="space-y-3 rounded-xl border bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={productoId || 'todos'} onValueChange={(v) => { setProductoId(v === 'todos' ? '' : v); setPagina(1) }}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Producto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Producto: Todos</SelectItem>
              {productos?.results.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.codigo} · {p.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por lote…"
              className="pl-9 w-56"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>

          <Button
            onClick={() => setModalNuevo(true)}
            disabled={!productoId}
            title={productoId ? undefined : 'Selecciona un producto para crear un lote'}
          >
            <Plus className="size-4" /> Nuevo lote
          </Button>

          <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
            <span>Mostrar</span>
            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPagina(1) }}>
              <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Tabla de lotes: HU06-HU09 */}
      <div className="rounded-xl border bg-white p-6">
        <h2 className="mb-4 font-semibold">Lotes de inventario</h2>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Lote</TableHead>
                <TableHead>Fecha ingreso</TableHead>
                <TableHead className="text-right">Cant. Inicial</TableHead>
                <TableHead className="text-right">Cant. Actual</TableHead>
                <TableHead>Vencimiento</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    Cargando…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && lotes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No hay lotes para los filtros seleccionados.
                  </TableCell>
                </TableRow>
              )}
              {lotes.map((lote) => {
                const actual = aNumero(lote.cantidad_actual)
                const { texto, variante } = estadoLote(lote.fecha_vencimiento, actual)
                return (
                  <TableRow key={lote.id}>
                    <TableCell>
                      <div className="font-medium">{lote.producto_nombre}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{lote.numero_lote}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatoFecha.format(new Date(lote.fecha_ingreso))}
                    </TableCell>
                    <TableCell className="text-right">{aNumero(lote.cantidad_inicial)}</TableCell>
                    <TableCell className="text-right font-medium">{actual}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatoFecha.format(new Date(lote.fecha_vencimiento))}
                    </TableCell>
                    <TableCell>
                      <Badge variant={variante}>{texto}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Ver historial"
                          onClick={() => setLoteDetalle(lote)}
                        >
                          <Eye className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Movimiento de stock"
                          onClick={() => setLoteMovimiento(lote)}
                        >
                          <PackagePlus className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>

        {data && data.count > 0 && (
          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {data.count} lote{data.count === 1 ? '' : 's'} en total
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!data.previous}
                onClick={() => setPagina((p) => p - 1)}
              >
                <ChevronLeft className="size-4" /> Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!data.next}
                onClick={() => setPagina((p) => p + 1)}
              >
                Siguiente <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Nuevo lote (HU07) */}
      <NuevoLoteModal
        open={modalNuevo}
        onOpenChange={setModalNuevo}
        productoId={productoSeleccionado?.id ?? null}
        productoNombre={productoSeleccionado?.nombre ?? ''}
        vidaUtil={productoSeleccionado?.categoria_vida_util_dias ?? null}
      />

      {/* Historial del lote (HU09) */}
      <LoteDetalleSheet
        loteId={loteDetalle?.id ?? null}
        open={!!loteDetalle}
        onOpenChange={(open) => !open && setLoteDetalle(null)}
      />

      {/* Movimiento de stock sobre el lote (HU08) */}
      {loteMovimiento && (
        <RegistrarMovimientoModal
          open={!!loteMovimiento}
          onOpenChange={(open) => !open && setLoteMovimiento(null)}
          loteId={loteMovimiento.id}
          loteNumero={loteMovimiento.numero_lote}
          productoNombre={loteMovimiento.producto_nombre}
          productoCodigo={codigoDelLote(loteMovimiento)}
          stockActual={aNumero(loteMovimiento.cantidad_actual)}
        />
      )}

    </div>
  )
}
