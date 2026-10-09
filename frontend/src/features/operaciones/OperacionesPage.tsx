import { useEffect, useState } from 'react'
import {
  PackagePlus, Plus, ReceiptText, Search, Trash2, Undo2, Wallet, Upload,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { ApiError } from '@/lib/api'
import { useProductos } from '@/features/productos/api'
import {
  useAnularOperacion,
  useComprobante,
  useCrearOperacion,
  useImpuesto,
  useImportarKardex,
  useOperaciones,
  useOperacion,
} from './api'
import { ClienteCombobox } from './components/ClienteCombobox'
import { ComprobanteModal } from './components/ComprobanteModal'
import { ImportarKardexModal } from './components/ImportarKardexModal'
import type { Cliente, Operacion, Producto, TipoOperacion } from '@/types'

const TIPOS: { value: TipoOperacion; label: string; descripcion: string }[] = [
  { value: 'venta', label: 'Venta', descripcion: 'Salida de inventario por venta' },
  { value: 'devolucion', label: 'Devolución', descripcion: 'Entrada por devolución o rechazo del cliente' },
  { value: 'ajuste', label: 'Ajuste', descripcion: 'Corrección de inventario' },
]

function aDateTimeLocal(fecha: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}T${pad(fecha.getHours())}:${pad(fecha.getMinutes())}`
}

function formatearMoneda(valor: number) {
  return `S/ ${valor.toFixed(2)}`
}

function puedeAnularOperacion(operacion: Operacion, ahora = Date.now()) {
  const fechaCreacion = new Date(operacion.fecha_creacion).getTime()
  const tiempoTranscurrido = ahora - fechaCreacion
  return Number.isFinite(fechaCreacion)
    && tiempoTranscurrido >= 0
    && tiempoTranscurrido < 2 * 24 * 60 * 60 * 1000
}

interface LineaForm {
  clave: number
  producto: Producto
  cantidad: string
  precio: string
}

// ===================================================================
// Formulario de nueva operación
// ===================================================================

function NuevaOperacionForm({ onExito }: { onExito: () => void }) {
  const [tipo, setTipo] = useState<TipoOperacion>('venta')
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [fecha, setFecha] = useState(() => aDateTimeLocal(new Date()))
  const [lineas, setLineas] = useState<LineaForm[]>([])
  const [motivo, setMotivo] = useState('')
  const [signo, setSigno] = useState<'aumenta' | 'disminuye'>('aumenta')
  const [ventaOriginal, setVentaOriginal] = useState<Operacion | null>(null)
  const [buscarProducto, setBuscarProducto] = useState(false)
  const [buscarVenta, setBuscarVenta] = useState(false)
  const [resultado, setResultado] = useState<Operacion | null>(null)

  // Clave de idempotencia: se regenera tras cada operación creada, así un
  // doble clic o reintento de red no duplica la operación.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())

  const { data: impuesto } = useImpuesto()
  const crearOperacion = useCrearOperacion()
  const { data: ventaVinculada } = useOperacion(ventaOriginal?.id ?? null)

  const impuestoPct = Number(impuesto?.impuesto_porcentaje ?? 0)

  const subtotal = lineas.reduce(
    (acum, linea) => acum + (parseFloat(linea.cantidad) || 0) * (parseFloat(linea.precio) || 0),
    0,
  )
  const impuestoTotal = impuestoPct > 0 ? (subtotal * impuestoPct) / 100 : 0
  const total = subtotal + impuestoTotal

  function agregarProducto(producto: Producto) {
    if (lineas.some((l) => l.producto.id === producto.id)) {
      toast.info(`${producto.codigo} ya está en la operación. Ajusta la cantidad si necesitas más.`)
      return
    }
    setLineas((antes) => [
      ...antes,
      {
        clave: Date.now() + antes.length,
        producto,
        cantidad: '1',
        precio: producto.precio_venta ?? '0',
      },
    ])
    setBuscarProducto(false)
  }

  function actualizarLinea(clave: number, campo: 'cantidad' | 'precio', valor: string) {
    setLineas((antes) =>
      antes.map((l) => (l.clave === clave ? { ...l, [campo]: valor } : l)),
    )
  }

  function quitarLinea(clave: number) {
    setLineas((antes) => antes.filter((l) => l.clave !== clave))
  }

  /** Llena el detalle con los productos de la venta original (devolución). */
  function cargarDeVentaOriginal() {
    if (!ventaVinculada?.detalles) return
    setLineas(
      ventaVinculada.detalles
        .filter((detalle) => (detalle.cantidad_disponible_devolucion ?? detalle.cantidad) > 0)
        .map((detalle, indice) => ({
        clave: Date.now() + indice,
        producto: {
          id: detalle.producto_id,
          codigo: detalle.producto_codigo ?? '',
          nombre: detalle.producto_nombre ?? '',
        } as Producto,
        cantidad: String(detalle.cantidad_disponible_devolucion ?? detalle.cantidad),
        precio: String(detalle.precio_unitario),
        })),
    )
    toast.success('Productos de la venta cargados en la devolución')
  }

  function validar(): string | null {
    if (tipo !== 'ajuste' && !cliente) return 'Debe seleccionar un cliente'
    if (tipo === 'devolucion' && !ventaOriginal) return 'Debe vincular la venta original'
    if (tipo === 'devolucion' && !motivo.trim()) return 'La devolución requiere un motivo'
    if (tipo === 'ajuste' && !motivo.trim()) return 'El ajuste requiere un motivo'
    if (lineas.length === 0) return 'Agregue al menos un producto'
    for (const linea of lineas) {
      const cantidad = parseFloat(linea.cantidad)
      if (!Number.isFinite(cantidad) || cantidad <= 0) {
        return `La cantidad de ${linea.producto.codigo} debe ser mayor a 0`
      }
      const precio = parseFloat(linea.precio)
      if (!Number.isFinite(precio) || precio < 0) {
        return `El precio de ${linea.producto.codigo} es inválido`
      }
      if (tipo === 'venta' && Number.isFinite(cantidad) && linea.producto.stock_total < cantidad) {
        return `Stock insuficiente de ${linea.producto.codigo} (hay ${linea.producto.stock_total})`
      }
    }
    return null
  }

  async function confirmar() {
    const error = validar()
    if (error) {
      toast.error(error)
      return
    }
    try {
      const respuesta = await crearOperacion.mutateAsync({
        tipo,
        cliente_id: cliente?.id ?? null,
        fecha,
        motivo: motivo.trim() || undefined,
        operacion_origen_id: tipo === 'devolucion' ? ventaOriginal?.id ?? null : null,
        signo: tipo === 'ajuste' ? signo : undefined,
        idempotency_key: idempotencyKey,
        items: lineas.map((linea) => ({
          producto_id: linea.producto.id,
          cantidad: parseFloat(linea.cantidad),
          precio_unitario: parseFloat(linea.precio),
        })),
      })
      setResultado(respuesta.data)
      setIdempotencyKey(crypto.randomUUID())
      setLineas([])
      setMotivo('')
      setVentaOriginal(null)
      setCliente(null)
      setFecha(aDateTimeLocal(new Date()))
      onExito()
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'No se pudo registrar la operación')
    }
  }

  const etiquetaConfirmar =
    tipo === 'venta' ? 'Confirmar venta' : tipo === 'devolucion' ? 'Registrar devolución' : 'Registrar ajuste'

  return (
    <div className="space-y-6">
      {/* Tipo de operación */}
      <div className="grid grid-cols-3 gap-3">
        {TIPOS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => {
              setTipo(t.value)
              setLineas([])
              setMotivo('')
            }}
            className={cn(
              'rounded-lg border p-4 text-left transition-colors',
              tipo === t.value
                ? 'border-primary bg-accent'
                : 'border-border hover:bg-muted',
            )}
          >
            <p className="font-semibold">{t.label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{t.descripcion}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>
            Cliente {tipo !== 'ajuste' && <span className="text-destructive">*</span>}
          </Label>
          <ClienteCombobox
            valor={cliente}
            onCambio={setCliente}
            obligatorio={tipo !== 'ajuste'}
            disabled={tipo === 'devolucion' && !!ventaOriginal}
          />
          {tipo === 'ajuste' && (
            <p className="text-xs text-muted-foreground">
              Opcional: solo se asocia cuando el motivo del ajuste está relacionado con un cliente.
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Fecha y hora</Label>
          <Input type="datetime-local" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
      </div>

      {/* Detalle de productos */}
      <div className="rounded-xl border">
        <div className="flex items-center justify-between border-b p-4">
          <h3 className="font-semibold">
            {tipo === 'ajuste' ? 'Producto a ajustar' : 'Productos de la operación'}
          </h3>
          <Button variant="outline" size="sm" onClick={() => setBuscarProducto(true)}>
            <Plus className="size-4" />
            Agregar producto
          </Button>
        </div>

        {lineas.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Aún no hay productos. Use «Agregar producto» para agregar el primero.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="p-3">Producto</th>
                <th className="p-3 text-right">Cantidad</th>
                <th className="p-3 text-right">Precio unitario</th>
                <th className="p-3 text-right">Subtotal</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {lineas.map((linea) => (
                <tr key={linea.clave}>
                  <td className="p-3">
                    <p className="font-medium">{linea.producto.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {linea.producto.codigo}
                      {tipo === 'venta' && (
                        <> · stock {linea.producto.stock_total}</>
                      )}
                    </p>
                  </td>
                  <td className="p-3 text-right">
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={linea.cantidad}
                      onChange={(e) => actualizarLinea(linea.clave, 'cantidad', e.target.value)}
                      className="w-24 text-right"
                    />
                  </td>
                  <td className="p-3 text-right">
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      value={linea.precio}
                      onChange={(e) => actualizarLinea(linea.clave, 'precio', e.target.value)}
                      className="w-28 text-right"
                    />
                  </td>
                  <td className="p-3 text-right font-medium">
                    {formatearMoneda(
                      (parseFloat(linea.cantidad) || 0) * (parseFloat(linea.precio) || 0),
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <button
                      type="button"
                      onClick={() => quitarLinea(linea.clave)}
                      className="rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                      aria-label="Quitar producto"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Totales */}
        {tipo !== 'ajuste' && lineas.length > 0 && (
          <div className="flex justify-end border-t p-4">
            <div className="w-64 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatearMoneda(subtotal)}</span>
              </div>
              {impuestoPct > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Impuesto ({impuestoPct}%)</span>
                  <span>{formatearMoneda(impuestoTotal)}</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-1 text-base font-bold">
                <span>Total</span>
                <span>{formatearMoneda(total)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Motivo y vinculación */}
      {(tipo === 'devolucion' || tipo === 'ajuste') && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>
              Motivo <span className="text-destructive">*</span>
            </Label>
            <Input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder={
                tipo === 'devolucion'
                  ? 'Ej. Producto rechazado por el cliente'
                  : 'Ej. Conteo de inventario, merma, rotura'
              }
            />
          </div>
          {tipo === 'devolucion' && (
            <div className="space-y-2">
              <Label>Venta original <span className="text-destructive">*</span></Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={ventaOriginal ? `${ventaOriginal.numero}` : ''}
                  placeholder="Seleccione la venta original"
                />
                <Button variant="outline" onClick={() => setBuscarVenta(true)}>
                  <Search className="size-4" />
                  Vincular
                </Button>
              </div>
              {ventaVinculada?.detalles && ventaVinculada.detalles.length > 0 && (
                <Button variant="ghost" size="sm" onClick={cargarDeVentaOriginal}>
                  <Undo2 className="size-4" />
                  Cargar productos de la venta
                </Button>
              )}
            </div>
          )}
          {tipo === 'ajuste' && (
            <div className="space-y-2">
              <Label>Sentido del ajuste</Label>
              <Select value={signo} onValueChange={(v) => setSigno(v as 'aumenta' | 'disminuye')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aumenta">Aumenta el stock</SelectItem>
                  <SelectItem value="disminuye">Disminuye el stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-3 border-t pt-4">
        <Button
          onClick={confirmar}
          disabled={crearOperacion.isPending}
          className="min-w-44"
        >
          <Wallet className="size-4" />
          {crearOperacion.isPending ? 'Registrando...' : etiquetaConfirmar}
        </Button>
      </div>

      {/* Buscador de productos */}
      <Dialog open={buscarProducto} onOpenChange={setBuscarProducto}>
        <BuscadorProductos onSeleccionar={agregarProducto} />
      </Dialog>

      {/* Buscador de ventas para vincular */}
      <Dialog open={buscarVenta} onOpenChange={setBuscarVenta}>
        <BuscadorVentas onSeleccionar={(venta) => {
          setVentaOriginal(venta)
          setCliente(venta.cliente ?? null)
          setLineas([])
          setBuscarVenta(false)
        }} />
      </Dialog>

      {/* Comprobante generado */}
      <ComprobanteModal
        comprobante={resultado?.comprobante ?? null}
        onCerrar={() => setResultado(null)}
      />
      {resultado && resultado.tipo === 'ajuste' && (
        <Dialog open onOpenChange={(abierto) => !abierto && setResultado(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajuste registrado</DialogTitle>
            </DialogHeader>
            <p className="text-sm">
              Operación <span className="font-mono font-semibold">{resultado.numero}</span> registrada.
              El stock se {'actualizó'} y el movimiento quedó en el kardex.
            </p>
            <DialogFooter>
              <Button onClick={() => setResultado(null)}>Aceptar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function BuscadorProductos({ onSeleccionar }: { onSeleccionar: (p: Producto) => void }) {
  const [buscar, setBuscar] = useState('')
  const [debounce, setDebounce] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebounce(buscar), 250)
    return () => clearTimeout(t)
  }, [buscar])

  const { data, isLoading } = useProductos({ search: debounce })
  const productos = data?.results ?? []

  return (
    <>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Agregar producto</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          placeholder="Buscar por nombre o código..."
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
        />
        <div className="max-h-80 overflow-y-auto rounded-md border">
          {isLoading && <p className="p-4 text-sm text-muted-foreground">Buscando...</p>}
          {!isLoading && productos.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">No se encontraron productos.</p>
          )}
          {!isLoading &&
            productos.map((producto) => (
              <button
                key={producto.id}
                type="button"
                onClick={() => onSeleccionar(producto)}
                className="flex w-full cursor-pointer items-center justify-between gap-3 border-b px-4 py-2.5 text-left text-sm last:border-0 hover:bg-muted"
              >
                <div>
                  <p className="font-medium">{producto.nombre}</p>
                  <p className="text-xs text-muted-foreground">
                    {producto.codigo}
                    {producto.unidad_medida_nombre ? ` · ${producto.unidad_medida_nombre}` : ''}
                  </p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>stock {producto.stock_total}</p>
                  <p>{producto.precio_venta ? formatearMoneda(parseFloat(producto.precio_venta)) : 'sin precio'}</p>
                </div>
              </button>
            ))}
        </div>
      </DialogContent>
    </>
  )
}

function BuscadorVentas({ onSeleccionar }: { onSeleccionar: (v: Operacion) => void }) {
  const [buscar, setBuscar] = useState('')
  const [debounce, setDebounce] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebounce(buscar), 250)
    return () => clearTimeout(t)
  }, [buscar])

  const { data, isLoading } = useOperaciones({ tipo: 'venta', buscar: debounce })

  return (
    <>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Vincular venta original</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          placeholder="Buscar por número de operación (V-...)"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
        />
        <div className="max-h-80 overflow-y-auto rounded-md border">
          {isLoading && <p className="p-4 text-sm text-muted-foreground">Buscando...</p>}
          {!isLoading && data && data.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">No se encontraron ventas.</p>
          )}
          {!isLoading &&
            data?.filter((venta) => venta.estado === 'activa').map((venta) => (
              <button
                key={venta.id}
                type="button"
                onClick={() => onSeleccionar(venta)}
                className="flex w-full cursor-pointer items-center justify-between gap-3 border-b px-4 py-2.5 text-left text-sm last:border-0 hover:bg-muted"
              >
                <div>
                  <p className="font-mono font-medium">{venta.numero}</p>
                  <p className="text-xs text-muted-foreground">
                    {venta.cliente?.nombre ?? 'Sin cliente'}
                  </p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>{new Date(venta.fecha).toLocaleDateString('es-PE')}</p>
                  <p>{formatearMoneda(venta.total)}</p>
                </div>
              </button>
            ))}
        </div>
      </DialogContent>
    </>
  )
}

// ===================================================================
// Historial de operaciones
// ===================================================================

const ETIQUETA_TIPO: Record<TipoOperacion, string> = {
  venta: 'Venta',
  devolucion: 'Devolución',
  ajuste: 'Ajuste',
}

function HistorialOperaciones() {
  const [filtros, setFiltros] = useState<{
    tipo: TipoOperacion | ''
    buscar: string
    fecha_desde: string
    fecha_hasta: string
  }>({ tipo: '', buscar: '', fecha_desde: '', fecha_hasta: '' })
  const [debounce, setDebounce] = useState('')
  const [detalleId, setDetalleId] = useState<number | null>(null)
  const [comprobanteId, setComprobanteId] = useState<number | null>(null)
  const [anularId, setAnularId] = useState<number | null>(null)
  const [ahora, setAhora] = useState(() => Date.now())

  useEffect(() => {
    const t = setTimeout(() => setDebounce(filtros.buscar), 250)
    return () => clearTimeout(t)
  }, [filtros.buscar])

  useEffect(() => {
    const intervalo = setInterval(() => setAhora(Date.now()), 60_000)
    return () => clearInterval(intervalo)
  }, [])

  const { data: operaciones, isLoading } = useOperaciones({
    tipo: filtros.tipo,
    buscar: debounce,
    fecha_desde: filtros.fecha_desde,
    fecha_hasta: filtros.fecha_hasta,
  })
  const { data: detalle } = useOperacion(detalleId)
  const {
    data: comprobante,
    isFetching: comprobanteCargando,
    error: errorComprobante,
  } = useComprobante(comprobanteId)
  const anularOperacion = useAnularOperacion()

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="grid grid-cols-4 gap-3">
        <Input
          placeholder="Buscar por número..."
          value={filtros.buscar}
          onChange={(e) => setFiltros((f) => ({ ...f, buscar: e.target.value }))}
        />
        <Select
          value={filtros.tipo}
          onValueChange={(v) => setFiltros((f) => ({ ...f, tipo: v as TipoOperacion | '' }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Todos los tipos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos los tipos</SelectItem>
            <SelectItem value="venta">Venta</SelectItem>
            <SelectItem value="devolucion">Devolución</SelectItem>
            <SelectItem value="ajuste">Ajuste</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={filtros.fecha_desde}
          onChange={(e) => setFiltros((f) => ({ ...f, fecha_desde: e.target.value }))}
        />
        <Input
          type="date"
          value={filtros.fecha_hasta}
          onChange={(e) => setFiltros((f) => ({ ...f, fecha_hasta: e.target.value }))}
        />
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-muted-foreground">
              <th className="p-4">Número</th>
              <th className="p-4">Tipo</th>
              <th className="p-4">Fecha</th>
              <th className="p-4">Cliente</th>
              <th className="p-4">Productos</th>
              <th className="p-4 text-right">Total</th>
              <th className="p-4">Estado</th>
              <th className="p-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && (
              <tr><td className="p-4 text-muted-foreground" colSpan={8}>Cargando operaciones...</td></tr>
            )}
            {!isLoading && operaciones?.map((operacion) => (
              <tr key={operacion.id}>
                <td className="p-4 font-mono font-medium">{operacion.numero}</td>
                <td className="p-4">
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-medium',
                      operacion.tipo === 'venta' && 'bg-secondary/15 text-secondary-foreground',
                      operacion.tipo === 'devolucion' && 'bg-accent text-accent-foreground',
                      operacion.tipo === 'ajuste' && 'bg-muted text-foreground',
                    )}
                  >
                    {ETIQUETA_TIPO[operacion.tipo]}
                  </span>
                </td>
                <td className="p-4">{new Date(operacion.fecha).toLocaleString('es-PE')}</td>
                <td className="p-4">{operacion.cliente?.nombre ?? '-'}</td>
                <td className="p-4">
                  {operacion.detalles
                    ? `${operacion.detalles.length} ${operacion.detalles.length === 1 ? 'producto' : 'productos'}`
                    : '-'}
                </td>
                <td className="p-4 text-right font-medium">{formatearMoneda(operacion.total)}</td>
                <td className="p-4">
                  {operacion.estado === 'anulada' ? (
                    <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                      Anulada
                    </span>
                  ) : (
                    <span className="rounded-full bg-secondary/15 px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                      Activa
                    </span>
                  )}
                </td>
                <td className="p-4">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setDetalleId(operacion.id)}>
                      Ver
                    </Button>
                    {operacion.comprobante && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setComprobanteId(operacion.id)}
                        aria-label={`Ver comprobante ${operacion.comprobante.numero}`}
                        title={`Ver comprobante ${operacion.comprobante.numero}`}
                      >
                        <ReceiptText className="size-4" />
                      </Button>
                    )}
                    {operacion.tipo === 'venta'
                      && operacion.estado === 'activa'
                      && puedeAnularOperacion(operacion, ahora)
                      && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setAnularId(operacion.id)}
                      >
                        Anular
                      </Button>
                      )}
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && operaciones && operaciones.length === 0 && (
              <tr>
                <td className="p-4 text-center text-muted-foreground" colSpan={8}>
                  No hay operaciones con esos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Detalle */}
      <Sheet open={detalleId !== null} onOpenChange={(abierto) => !abierto && setDetalleId(null)}>
        <SheetContent className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>
              {detalle ? `Operación ${detalle.numero}` : 'Operación'}
            </SheetTitle>
          </SheetHeader>
          {detalle && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Tipo</p>
                  <p>{ETIQUETA_TIPO[detalle.tipo]}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Estado</p>
                  <p>{detalle.estado === 'anulada' ? 'Anulada' : 'Activa'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Fecha</p>
                  <p>{new Date(detalle.fecha).toLocaleString('es-PE')}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Cliente</p>
                  <p>{detalle.cliente?.nombre ?? '-'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Vendedor</p>
                  <p>{detalle.usuario_nombre ?? '-'}</p>
                </div>
                {detalle.operacion_origen_numero && (
                  <div>
                    <p className="text-xs uppercase text-muted-foreground">Venta original</p>
                    <p className="font-mono">{detalle.operacion_origen_numero}</p>
                  </div>
                )}
              </div>

              {detalle.motivo && (
                <div className="rounded-md bg-muted p-3 text-sm">
                  <p className="text-xs uppercase text-muted-foreground">Motivo</p>
                  <p>{detalle.motivo}</p>
                </div>
              )}

              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                      <th className="p-3">Producto</th>
                      <th className="p-3 text-right">Cantidad</th>
                      <th className="p-3 text-right">P. unitario</th>
                      <th className="p-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {detalle.detalles?.map((det) => (
                      <tr key={det.id}>
                        <td className="p-3">
                          <p className="font-medium">{det.producto_nombre}</p>
                          <p className="text-xs text-muted-foreground">
                            {det.producto_codigo}
                            {det.lote_numero ? ` · ${det.lote_numero}` : ''}
                          </p>
                        </td>
                        <td className="p-3 text-right">{det.cantidad}</td>
                        <td className="p-3 text-right">{formatearMoneda(det.precio_unitario)}</td>
                        <td className="p-3 text-right">{formatearMoneda(det.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-6 text-sm">
                <span className="text-muted-foreground">
                  Subtotal: <span className="text-foreground">{formatearMoneda(detalle.subtotal)}</span>
                </span>
                {detalle.impuesto_porcentaje > 0 && (
                  <span className="text-muted-foreground">
                    Impuesto ({detalle.impuesto_porcentaje}%):{' '}
                    <span className="text-foreground">{formatearMoneda(detalle.impuesto)}</span>
                  </span>
                )}
                <span className="font-bold">Total: {formatearMoneda(detalle.total)}</span>
              </div>

              {detalle.comprobante && (
                <Button onClick={() => setComprobanteId(detalle.id)}>
                  <ReceiptText className="size-4" />
                  Ver comprobante {detalle.comprobante.numero}
                </Button>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Comprobante */}
      <ComprobanteModal
        comprobante={comprobanteCargando || errorComprobante ? null : comprobante ?? null}
        onCerrar={() => setComprobanteId(null)}
      />
      <Dialog
        open={comprobanteId !== null && (comprobanteCargando || Boolean(errorComprobante))}
        onOpenChange={(abierto) => !abierto && setComprobanteId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{errorComprobante ? 'No se pudo cargar el comprobante' : 'Cargando comprobante'}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {errorComprobante
              ? 'Ocurrió un error al recuperar los datos de la operación. Inténtelo nuevamente.'
              : 'Recuperando los datos de la venta…'}
          </p>
          {errorComprobante && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setComprobanteId(null)}>Cerrar</Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmación de anulación */}
      <Dialog open={anularId !== null} onOpenChange={(abierto) => !abierto && setAnularId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Anular la venta?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Se revertirá el descuento de inventario, la venta quedará como «anulada» y el
            movimiento se registrará en el kardex y la auditoría. Esta acción no se puede deshacer.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnularId(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={anularOperacion.isPending}
              onClick={async () => {
                if (anularId === null) return
                try {
                  await anularOperacion.mutateAsync(anularId)
                  toast.success('Venta anulada y stock restaurado')
                  setAnularId(null)
                  setDetalleId(null)
                } catch (error) {
                  toast.error(error instanceof ApiError ? error.message : 'No se pudo anular')
                }
              }}
            >
              {anularOperacion.isPending ? 'Anulando...' : 'Sí, anular venta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ===================================================================
// Página
// ===================================================================

export default function OperacionesPage() {
  const [pestaña, setPestaña] = useState<'nueva' | 'historial'>('nueva')
  const [contadorExito, setContadorExito] = useState(0)
  const [importarAbierto, setImportarAbierto] = useState(false)
  const importarKardex = useImportarKardex()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Operaciones</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ventas, devoluciones de cliente y ajustes de inventario con comprobante.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setImportarAbierto(true)}
            disabled={importarKardex.isPending}
          >
            <Upload className="size-4" />
            Importar kardex histórico
          </Button>
          <div className="flex rounded-lg border p-1">
            {(['nueva', 'historial'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPestaña(p)}
                className={cn(
                  'cursor-pointer rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
                  pestaña === p ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {p === 'nueva' ? 'Nueva operación' : 'Historial'}
                {p === 'nueva' && <PackagePlus className="ml-2 inline size-4" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      <ImportarKardexModal open={importarAbierto} onOpenChange={setImportarAbierto} />

      {pestaña === 'nueva' ? (
        <NuevaOperacionForm key={contadorExito} onExito={() => setContadorExito((c) => c + 1)} />
      ) : (
        <HistorialOperaciones />
      )}
    </div>
  )
}
