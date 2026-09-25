import { useState } from 'react'
import { Search, Plus, Pencil, Ban, RotateCcw, Image as IMAGE_ICON } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { ApiError, resolverImagenProducto } from '@/lib/api'

import {
  useProductos, useCategorias, useMarcas, useActivarProducto, type Producto,
} from './api'
import { NuevoProductoModal } from './components/NuevoProductoModal'
import { EditarProductoModal } from './components/EditarProductoModal'
import { DesactivarProductoDialog } from './components/DesactivarProductoDialog'
import { ConfirmDialog } from './components/ConfirmDialog'

// "AJI-NO-MEN CARNE" + 80 + "GR" -> "AJI-NO-MEN CARNE 80 GR"
function nombreConContenido(producto: Producto): string {
  const partes = [producto.nombre]
  if (producto.contenido_valor != null && producto.unidad_medida_simbolo) {
    partes.push(`${producto.contenido_valor} ${producto.unidad_medida_simbolo}`)
  }
  return partes.join(' ')
}

export default function ProductosPage() {
  // HU04: búsqueda y filtro
  const [busqueda, setBusqueda] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('')
  const [marcaFiltro, setMarcaFiltro] = useState<string>('')

  const [modalNuevo, setModalNuevo] = useState(false)
  const [productoEditar, setProductoEditar] = useState<Producto | null>(null)
  const [productoDesactivar, setProductoDesactivar] = useState<Producto | null>(null)
  const [productoActivar, setProductoActivar] = useState<Producto | null>(null)

  const { data: productos, isLoading } = useProductos({
    search: busqueda, categoria: categoriaFiltro, marca: marcaFiltro,
  })
  const { data: categorias } = useCategorias()
  const { data: marcas } = useMarcas()
  const activar = useActivarProducto()

  async function confirmarActivar() {
    if (!productoActivar) return
    try {
      await activar.mutateAsync(productoActivar.id)
      toast.success('Producto reactivado')
      setProductoActivar(null)
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'No se pudo reactivar el producto')
    }
  }

  return (
    <div className="space-y-6">
      {/* Toolbar: HU04 (buscar/filtrar) + HU02 (nuevo producto) */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por código o nombre…"
            className="pl-9"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <Select value={categoriaFiltro || 'todas'} onValueChange={(v) => setCategoriaFiltro(v === 'todas' ? '' : v)}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Categoría" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Categoría: Todas</SelectItem>
            {categorias?.results.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>{c.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={marcaFiltro || 'todas'} onValueChange={(v) => setMarcaFiltro(v === 'todas' ? '' : v)}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Marca" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Marca: Todas</SelectItem>
            {marcas?.results.map((m) => (
              <SelectItem key={m.id} value={String(m.id)}>{m.nombre}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => setModalNuevo(true)}>
          <Plus className="size-4" /> Nuevo producto
        </Button>
      </div>

      <div className="rounded-xl border bg-white p-6">
        <h2 className="mb-4 font-semibold">Catálogo de productos</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14"></TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Cargando…</TableCell></TableRow>
            )}
            {!isLoading && productos?.results.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No hay productos para los criterios seleccionados.
                </TableCell>
              </TableRow>
            )}
            {productos?.results.map((producto) => (
              <TableRow key={producto.id}>
                <TableCell>
                  <div className="grid size-10 place-items-center overflow-hidden rounded-md border bg-muted">
                    {resolverImagenProducto(producto.imagen) ? (
                      <img src={resolverImagenProducto(producto.imagen) ?? undefined} alt={producto.nombre} className="size-full object-cover" />
                    ) : (
                      <IMAGE_ICON className="size-4 text-muted-foreground" />
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{producto.codigo}</TableCell>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {nombreConContenido(producto)}
                    {producto.es_bonificacion && (
                      <Badge variant="secondary" className="text-xs font-normal">Obsequio</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>{producto.categoria_nombre ?? '—'}</TableCell>
                <TableCell>
                  {producto.stock_total}
                  {producto.stock_total === 0 && (
                    <span className="ml-1 text-xs text-muted-foreground">(sin stock)</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={producto.activo ? 'bajo' : 'secondary'}>
                    {producto.activo ? 'Activo' : 'Inactivo'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Editar"
                      onClick={() => setProductoEditar(producto)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    {producto.activo ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Desactivar"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setProductoDesactivar(producto)}
                      >
                        <Ban className="size-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Reactivar"
                        className="text-secondary hover:text-secondary"
                        onClick={() => setProductoActivar(producto)}
                      >
                        <RotateCcw className="size-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <NuevoProductoModal open={modalNuevo} onOpenChange={setModalNuevo} />

      <EditarProductoModal producto={productoEditar} onOpenChange={(open) => !open && setProductoEditar(null)} />

      <DesactivarProductoDialog
        producto={productoDesactivar}
        onOpenChange={(open) => !open && setProductoDesactivar(null)}
      />

      <ConfirmDialog
        open={!!productoActivar}
        onOpenChange={(open) => !open && setProductoActivar(null)}
        titulo="¿Reactivar este producto?"
        descripcion={`${productoActivar?.nombre ?? ''} va a volver a aparecer en el catálogo activo y podrá venderse de nuevo.`}
        textoConfirmar="Sí, reactivar"
        variante="positiva"
        onConfirmar={confirmarActivar}
        cargando={activar.isPending}
      />
    </div>
  )
}