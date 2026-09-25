import { useState } from 'react'
import { Search, ChevronLeft, ChevronRight, ArrowDownCircle, ArrowUpCircle, RefreshCcw } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'

import { useProductos } from '@/features/productos/api'
import { useMovimientos, TIPOS_MOVIMIENTO, ORIGENES_MOVIMIENTO, type TipoMovimiento, type OrigenMovimiento } from './api'

const formatoMoneda = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' })
const formatoFecha = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' })

const ICONO_TIPO: Record<TipoMovimiento, typeof ArrowDownCircle> = {
  ingreso: ArrowDownCircle,
  salida: ArrowUpCircle,
  ajuste: RefreshCcw,
}

export default function KardexPage() {
  const [busqueda, setBusqueda] = useState('')
  const [productoId, setProductoId] = useState('')
  const [tipo, setTipo] = useState<TipoMovimiento | ''>('')
  const [origen, setOrigen] = useState<OrigenMovimiento | ''>('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [desdeUltimoIngreso, setDesdeUltimoIngreso] = useState(false)
  const [pageSize, setPageSize] = useState('10')
  const [pagina, setPagina] = useState(1)

  const { data: productos } = useProductos({})
  const { data, isLoading } = useMovimientos({
    search: busqueda,
    producto: productoId,
    tipo,
    origen,
    fecha_desde: fechaDesde,
    fecha_hasta: fechaHasta,
    desdeUltimoIngreso: desdeUltimoIngreso && !!productoId,
    pageSize: pageSize === 'todo' ? '500' : pageSize,
    page: pagina,
  })

  return (
    <div className="space-y-6">
      {/* Filtros: búsqueda libre por nombre/código + filtros avanzados */}
      <div className="space-y-3 rounded-xl border bg-white p-4">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, código o lote…"
            className="pl-9"
            value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); setPagina(1) }}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Desde</label>
            <Input
              type="date"
              value={fechaDesde}
              onChange={(e) => { setFechaDesde(e.target.value); setPagina(1) }}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Hasta</label>
            <Input
              type="date"
              value={fechaHasta}
              onChange={(e) => { setFechaHasta(e.target.value); setPagina(1) }}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Producto</label>
            <Select value={productoId || 'todos'} onValueChange={(v) => { setProductoId(v === 'todos' ? '' : v); setPagina(1) }}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Producto específico" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Producto: Todos</SelectItem>
                {productos?.results.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.codigo} · {p.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Mostrar</label>
            <Select value={pageSize} onValueChange={(v) => { setPageSize(v); setPagina(1) }}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="todo">Desde el inicio</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Select value={tipo || 'todos'} onValueChange={(v) => { setTipo(v === 'todos' ? '' : v as TipoMovimiento); setPagina(1) }}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Tipo: Todos</SelectItem>
              {TIPOS_MOVIMIENTO.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={origen || 'todos'} onValueChange={(v) => { setOrigen(v === 'todos' ? '' : v as OrigenMovimiento); setPagina(1) }}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Origen" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Origen: Todos</SelectItem>
              {ORIGENES_MOVIMIENTO.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>

          <label className={`flex items-center gap-2 text-sm ${!productoId ? 'text-muted-foreground/50' : ''}`}>
            <input
              type="checkbox"
              disabled={!productoId}
              checked={desdeUltimoIngreso}
              onChange={(e) => { setDesdeUltimoIngreso(e.target.checked); setPagina(1) }}
              className="size-4 rounded border-input accent-primary"
            />
            Solo desde el último ingreso
          </label>
        </div>
      </div>

      {/* Tabla del kardex */}
      <div className="rounded-xl border bg-white p-6">
        <h2 className="mb-4 font-semibold">Movimientos de inventario</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>Movimiento</TableHead>
              <TableHead className="text-right">Cantidad</TableHead>
              <TableHead className="text-right">P. unitario</TableHead>
              <TableHead className="text-right">P. total</TableHead>
              <TableHead className="text-right">Saldo cant.</TableHead>
              <TableHead className="text-right">Saldo valorizado</TableHead>
              <TableHead>Usuario</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Cargando…</TableCell></TableRow>
            )}
            {!isLoading && data?.results.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground">
                  No hay movimientos para los filtros seleccionados.
                </TableCell>
              </TableRow>
            )}
            {data?.results.map((mov) => {
              const Icono = ICONO_TIPO[mov.tipo]
              const esIngreso = mov.tipo === 'ingreso'
              return (
                <TableRow key={mov.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatoFecha.format(new Date(mov.fecha))}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{mov.producto_nombre}</div>
                    <div className="text-xs text-muted-foreground">{mov.producto_codigo} · Lote {mov.lote_numero}</div>
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
                  <TableCell className="text-right">{mov.precio_unitario != null ? formatoMoneda.format(mov.precio_unitario) : '—'}</TableCell>
                  <TableCell className="text-right">{mov.precio_total != null ? formatoMoneda.format(mov.precio_total) : '—'}</TableCell>
                  <TableCell className="text-right">{mov.saldo_cantidad}</TableCell>
                  <TableCell className="text-right">{formatoMoneda.format(mov.saldo_valorizado)}</TableCell>
                  <TableCell className="text-muted-foreground">{mov.usuario_nombre ?? '—'}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>

        {data && data.count > 0 && (
          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>{data.count} movimiento{data.count === 1 ? '' : 's'} en total</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={!data.previous} onClick={() => setPagina((p) => p - 1)}>
                <ChevronLeft className="size-4" /> Anterior
              </Button>
              <Button variant="outline" size="sm" disabled={!data.next} onClick={() => setPagina((p) => p + 1)}>
                Siguiente <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
