import { useMemo, useState } from 'react'
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
type GrupoLotes = {
  key: string
  nombre: string
  productoIds: number[]
  lotes: Lote[]
}

const ESTADO_LOTE: Record<string, { texto: string; variante: BadgeVariante }> = {
  AGOTADO: { texto: 'Agotado', variante: 'secondary' },
  VENCIDO: { texto: 'Vencido', variante: 'alto' },
  POR_VENCER: { texto: 'Próximo a vencer', variante: 'medio' },
  VIGENTE: { texto: 'Vigente', variante: 'bajo' },
}

function aNumero(v: number | string | null | undefined): number {
  return Number(v ?? 0)
}

function claveNombre(nombre: string | null | undefined): string {
  return (nombre ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es')
}

function hoyISO(): string {
  const hoy = new Date()
  const mes = String(hoy.getMonth() + 1).padStart(2, '0')
  const dia = String(hoy.getDate()).padStart(2, '0')
  return `${hoy.getFullYear()}-${mes}-${dia}`
}

export default function InventarioPage() {
  const [busqueda, setBusqueda] = useState('')
  const [productoClave, setProductoClave] = useState('')
  const [pageSize, setPageSize] = useState(10)
  const [pagina, setPagina] = useState(1)

  const [modalNuevo, setModalNuevo] = useState(false)
  const [grupoDetalle, setGrupoDetalle] = useState<GrupoLotes | null>(null)
  const [loteMovimiento, setLoteMovimiento] = useState<Lote | null>(null)

  const { data: productos } = useProductos({})
  const { data, isLoading } = useLotes()

  function codigoDelLote(lote: Lote): string {
    return productos?.results.find((p) => p.id === lote.producto_id)?.codigo ?? ''
  }

  const lotes = data?.results ?? []
  const grupos = useMemo(() => {
    const agrupados = new Map<string, GrupoLotes>()
    for (const lote of lotes) {
      const nombre = lote.producto_nombre?.trim() || `Producto ${lote.producto_id}`
      const key = claveNombre(nombre) || `producto-${lote.producto_id}`
      const grupo = agrupados.get(key) ?? {
        key,
        nombre,
        productoIds: [],
        lotes: [],
      }
      if (!grupo.productoIds.includes(lote.producto_id)) grupo.productoIds.push(lote.producto_id)
      grupo.lotes.push(lote)
      agrupados.set(key, grupo)
    }

    const textoBusqueda = busqueda.trim().toLocaleLowerCase('es')
    return [...agrupados.values()]
      .filter((grupo) => !productoClave || grupo.key === productoClave)
      .filter((grupo) => !textoBusqueda || (
        grupo.nombre.toLocaleLowerCase('es').includes(textoBusqueda)
        || grupo.lotes.some((lote) => (
          lote.numero_lote.toLocaleLowerCase('es').includes(textoBusqueda)
          || codigoDelLote(lote).toLocaleLowerCase('es').includes(textoBusqueda)
        ))
      ))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [lotes, busqueda, productoClave, productos])
  const gruposVisibles = grupos.slice((pagina - 1) * pageSize, pagina * pageSize)
  const paginasTotales = Math.ceil(grupos.length / pageSize)
  const fechaHoy = hoyISO()

  const productosUnicos = [...new Map(
    (productos?.results ?? []).map((producto) => [claveNombre(producto.nombre), producto]),
  ).values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

  return (
    <div className="space-y-6">
      {/* Toolbar: HU06 — buscar/filtrar lotes por producto y lote + crear lote */}
      <div className="space-y-3 rounded-xl border bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={productoClave || 'todos'} onValueChange={(v) => { setProductoClave(v === 'todos' ? '' : v); setPagina(1) }}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Producto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Producto: Todos</SelectItem>
              {productosUnicos.map((p) => (
                <SelectItem key={claveNombre(p.nombre)} value={claveNombre(p.nombre)}>
                  {p.nombre}
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
              onChange={(e) => { setBusqueda(e.target.value); setPagina(1) }}
            />
          </div>

          <Button
            onClick={() => setModalNuevo(true)}
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
                <TableHead>Lotes</TableHead>
                <TableHead>Último ingreso</TableHead>
                <TableHead className="text-right">Cant. Inicial</TableHead>
                <TableHead className="text-right">Cant. Actual</TableHead>
                <TableHead>Próximo vencimiento / lote</TableHead>
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
              {gruposVisibles.map((grupo) => {
                const lotesConStock = grupo.lotes.filter((lote) => aNumero(lote.cantidad_actual) > 0)
                const lotesConVencimiento = lotesConStock
                  .filter((lote) => lote.fecha_vencimiento)
                  .sort((a, b) => String(a.fecha_vencimiento).localeCompare(String(b.fecha_vencimiento)))
                const loteProximo = lotesConVencimiento.find(
                  (lote) => String(lote.fecha_vencimiento) >= fechaHoy,
                ) ?? lotesConVencimiento[0] ?? null
                const loteAccion = loteProximo ?? lotesConStock[0] ?? grupo.lotes[0]
                const ultimoIngreso = [...grupo.lotes].sort(
                  (a, b) => b.fecha_ingreso.localeCompare(a.fecha_ingreso),
                )[0]
                const actual = grupo.lotes.reduce((total, lote) => total + aNumero(lote.cantidad_actual), 0)
                const inicial = grupo.lotes.reduce((total, lote) => total + aNumero(lote.cantidad_inicial), 0)
                const { texto, variante } = ESTADO_LOTE[loteProximo?.estado ?? 'VIGENTE']
                return (
                  <TableRow key={grupo.key}>
                    <TableCell>
                      <div className="font-medium">{grupo.nombre}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {grupo.lotes.length} lote{grupo.lotes.length === 1 ? '' : 's'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatoFecha.format(new Date(ultimoIngreso.fecha_ingreso))}
                    </TableCell>
                    <TableCell className="text-right">{inicial}</TableCell>
                    <TableCell className="text-right font-medium">{actual}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {loteProximo?.fecha_vencimiento ? (
                        <>
                          <div>{formatoFecha.format(new Date(loteProximo.fecha_vencimiento))}</div>
                          <div className="text-xs">{loteProximo.numero_lote} · #{loteProximo.id}</div>
                        </>
                      ) : 'Pendiente ML'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={loteProximo?.fecha_vencimiento ? variante : 'outline'}>
                        {loteProximo?.fecha_vencimiento ? texto : 'Pendiente ML'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Ver historial"
                          onClick={() => setGrupoDetalle(grupo)}
                        >
                          <Eye className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title={`Movimiento de stock · ${loteAccion.numero_lote}`}
                          onClick={() => setLoteMovimiento(loteAccion)}
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

        {data && grupos.length > 0 && (
          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {grupos.length} producto{grupos.length === 1 ? '' : 's'} agrupado{grupos.length === 1 ? '' : 's'}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagina <= 1}
                onClick={() => setPagina((p) => p - 1)}
              >
                <ChevronLeft className="size-4" /> Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagina >= paginasTotales}
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
        productos={productos?.results ?? []}
      />

      {/* Historial del lote (HU09) */}
      <LoteDetalleSheet
        productoNombre={grupoDetalle?.nombre ?? ''}
        productoIds={grupoDetalle?.productoIds ?? []}
        open={!!grupoDetalle}
        onOpenChange={(open) => !open && setGrupoDetalle(null)}
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
