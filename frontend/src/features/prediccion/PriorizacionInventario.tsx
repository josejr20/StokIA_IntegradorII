import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  PackageCheck,
  RefreshCw,
  Search,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { useProductos } from '@/features/productos/api'
import {
  useLotes,
  useMovimientosInventario,
  type Lote,
  type MovimientoInventario,
} from '@/features/inventario/api'

type NivelPrioridad = 'Alta' | 'Media' | 'Baja'
type FiltroPrioridad = 'Todas' | NivelPrioridad

type ProductoEvaluado = {
  id: number
  codigo: string
  nombre: string
  stock: number
  demanda30: number
  diasCobertura: number | null
  diasVencer: number | null
  prioridad: NivelPrioridad
  motivo: string
}

const fechaHoy = () => {
  const fecha = new Date()
  return [
    fecha.getFullYear(),
    String(fecha.getMonth() + 1).padStart(2, '0'),
    String(fecha.getDate()).padStart(2, '0'),
  ].join('-')
}

const fechaHace30Dias = () => {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() - 30)

  return [
    fecha.getFullYear(),
    String(fecha.getMonth() + 1).padStart(2, '0'),
    String(fecha.getDate()).padStart(2, '0'),
  ].join('-')
}

function evaluarPrioridad(
  producto: {
    id: number
    codigo: string
    nombre: string
    stock_total: number
  },
  lotes: Lote[],
  movimientos: MovimientoInventario[],
): ProductoEvaluado {
  const lotesProducto = lotes.filter(
    (lote) =>
      lote.producto_id === producto.id &&
      Number(lote.cantidad_actual) > 0,
  )

  const stock = Math.max(0, Number(producto.stock_total ?? 0))

  // Considerar las salidas por ventas de los últimos 30 días.
  const inicioPeriodo = `${fechaHace30Dias()}T00:00:00`
  const finPeriodo = `${fechaHoy()}T23:59:59`

  const salidas = movimientos.filter((movimiento) => {
    if (
      movimiento.producto_id !== producto.id ||
      movimiento.tipo !== 'salida' ||
      movimiento.origen !== 'venta'
    ) {
      return false
    }

    const fechaMovimiento = movimiento.fecha
    return (
      fechaMovimiento >= inicioPeriodo &&
      fechaMovimiento <= finPeriodo
    )
  })

  const demanda30 = salidas.reduce(
    (total, movimiento) =>
      total + Math.max(0, Number(movimiento.cantidad ?? 0)),
    0,
  )

  const demandaDiaria = demanda30 / 30

  const diasCobertura =
    demandaDiaria > 0 ? stock / demandaDiaria : null

  // Calcular los días hasta el vencimiento más cercano.
  const diasVencer = lotesProducto.reduce<number | null>(
    (minimo, lote) => {
      if (!lote.fecha_vencimiento) return minimo

      const vencimiento = new Date(
        `${lote.fecha_vencimiento.slice(0, 10)}T00:00:00`,
      )

      if (Number.isNaN(vencimiento.getTime())) return minimo

      const hoy = new Date(`${fechaHoy()}T00:00:00`)
      const dias = Math.ceil(
        (vencimiento.getTime() - hoy.getTime()) / 86400000,
      )

      return minimo === null ? dias : Math.min(minimo, dias)
    },
    null,
  )

  const riesgoVencimiento =
    diasVencer !== null && diasVencer <= 30

  const bajaRotacion = demanda30 === 0
  const motivos: string[] = []

  if (stock <= 0) {
    motivos.push('Sin stock disponible')
  }

  if (riesgoVencimiento) {
    motivos.push(
      diasVencer! < 0
        ? 'Producto con lote vencido'
        : `Vencimiento en ${diasVencer} día(s)`,
    )
  }

  if (bajaRotacion) {
    motivos.push('Sin ventas registradas en 30 días')
  }

  if (diasCobertura !== null && diasCobertura < 7) {
    motivos.push('Stock para menos de 7 días de demanda')
  }

  let prioridad: NivelPrioridad

  if (
    (riesgoVencimiento && bajaRotacion) ||
    stock <= 0 ||
    (riesgoVencimiento &&
      diasCobertura !== null &&
      diasCobertura < 7)
  ) {
    prioridad = 'Alta'
  } else if (
    riesgoVencimiento ||
    bajaRotacion ||
    (diasCobertura !== null && diasCobertura < 14)
  ) {
    prioridad = 'Media'
  } else {
    prioridad = 'Baja'
  }

  return {
    id: producto.id,
    codigo: producto.codigo,
    nombre: producto.nombre,
    stock,
    demanda30,
    diasCobertura,
    diasVencer,
    prioridad,
    motivo: motivos.length
      ? motivos.join(' · ')
      : 'Stock y rotación adecuados',
  }
}

const estilosPrioridad: Record<NivelPrioridad, string> = {
  Alta: 'border-red-200 bg-red-100 text-red-800',
  Media: 'border-amber-200 bg-amber-100 text-amber-800',
  Baja: 'border-green-200 bg-green-100 text-green-800',
}

export default function PrediccionPage() {
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<FiltroPrioridad>('Todas')

  const {
    data: productosData,
    isLoading: cargandoProductos,
    isError: errorProductos,
    refetch: recargarProductos,
  } = useProductos({ page: 1, pageSize: 100 })

  const {
    data: lotesData,
    isLoading: cargandoLotes,
    isError: errorLotes,
    refetch: recargarLotes,
  } = useLotes({ pageSize: 100 })

  const {
    data: movimientosData,
    isLoading: cargandoMovimientos,
    isError: errorMovimientos,
    refetch: recargarMovimientos,
  } = useMovimientosInventario({
    fecha_desde: fechaHace30Dias(),
    fecha_hasta: fechaHoy(),
    pageSize: 100,
  })

  const filas = useMemo(() => {
    const productos = productosData?.results ?? []
    const lotes = lotesData?.results ?? []
    const movimientos = movimientosData?.results ?? []

    return productos
      .filter((producto) => producto.activo)
      .map((producto) =>
        evaluarPrioridad(producto, lotes, movimientos),
      )
      .sort((a, b) => {
        const orden: Record<NivelPrioridad, number> = {
          Alta: 0,
          Media: 1,
          Baja: 2,
        }

        return (
          orden[a.prioridad] - orden[b.prioridad] ||
          a.nombre.localeCompare(b.nombre, 'es')
        )
      })
  }, [productosData, lotesData, movimientosData])

  const visibles = filas.filter((producto) => {
    const texto =
      `${producto.nombre} ${producto.codigo}`.toLowerCase()

    const coincideBusqueda = texto.includes(
      busqueda.trim().toLowerCase(),
    )

    const coincideFiltro =
      filtro === 'Todas' || producto.prioridad === filtro

    return coincideBusqueda && coincideFiltro
  })

  const altas = filas.filter((p) => p.prioridad === 'Alta').length
  const medias = filas.filter((p) => p.prioridad === 'Media').length
  const bajas = filas.filter((p) => p.prioridad === 'Baja').length

  const cargando =
    cargandoProductos || cargandoLotes || cargandoMovimientos

  const hayError =
    errorProductos || errorLotes || errorMovimientos

  async function actualizarEvaluacion() {
    await Promise.all([
      recargarProductos(),
      recargarLotes(),
      recargarMovimientos(),
    ])
  }

  return (
    <main className="space-y-6 p-4 md:p-6">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Priorización de inventario
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Identifica los productos que requieren mayor atención
            según stock, demanda y riesgo de vencimiento.
          </p>
        </div>

        <Button
          variant="outline"
          onClick={() => void actualizarEvaluacion()}
          disabled={cargando}
        >
          <RefreshCw className="mr-2 size-4" />
          Actualizar evaluación
        </Button>
      </header>

      {hayError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          No se pudieron cargar todos los datos del inventario.
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2 text-sm text-red-800">
            <AlertTriangle className="size-4" />
            Prioridad alta
          </div>
          <p className="mt-2 text-3xl font-semibold text-red-900">
            {altas}
          </p>
          <p className="mt-1 text-xs text-red-800">
            Requieren atención prioritaria
          </p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-sm text-amber-800">
            Prioridad media
          </div>
          <p className="mt-2 text-3xl font-semibold text-amber-900">
            {medias}
          </p>
          <p className="mt-1 text-xs text-amber-800">
            Requieren seguimiento
          </p>
        </div>

        <div className="rounded-xl border border-green-200 bg-green-50 p-4">
          <div className="flex items-center gap-2 text-sm text-green-800">
            <PackageCheck className="size-4" />
            Prioridad baja
          </div>
          <p className="mt-2 text-3xl font-semibold text-green-900">
            {bajas}
          </p>
          <p className="mt-1 text-xs text-green-800">
            Situación estable
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nombre o código..."
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {(['Todas', 'Alta', 'Media', 'Baja'] as const).map(
            (nivel) => (
              <Button
                key={nivel}
                size="sm"
                variant={filtro === nivel ? 'default' : 'outline'}
                onClick={() => setFiltro(nivel)}
              >
                {nivel}
              </Button>
            ),
          )}
        </div>
      </section>

      <section className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Demanda (30 días)</TableHead>
              <TableHead>Cobertura</TableHead>
              <TableHead>Vencimiento</TableHead>
              <TableHead>Prioridad</TableHead>
              <TableHead>Motivo</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {cargando ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-8 text-center"
                >
                  Cargando información del inventario.
                </TableCell>
              </TableRow>
            ) : visibles.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-8 text-center text-muted-foreground"
                >
                  No se encontraron productos para mostrar.
                </TableCell>
              </TableRow>
            ) : (
              visibles.map((producto) => (
                <TableRow key={producto.id}>
                  <TableCell>
                    <div className="font-medium">
                      {producto.nombre}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {producto.codigo}
                    </div>
                  </TableCell>

                  <TableCell>{producto.stock}</TableCell>

                  <TableCell>{producto.demanda30}</TableCell>

                  <TableCell>
                    {producto.diasCobertura === null
                      ? 'Sin demanda registrada'
                      : `${producto.diasCobertura.toFixed(1)} días`}
                  </TableCell>

                  <TableCell>
                    {producto.diasVencer === null
                      ? 'Sin fecha registrada'
                      : producto.diasVencer < 0
                        ? `Vencido hace ${Math.abs(producto.diasVencer)} día(s)`
                        : `${producto.diasVencer} día(s)`}
                  </TableCell>

                  <TableCell>
                    <Badge className={estilosPrioridad[producto.prioridad]}>
                      {producto.prioridad}
                    </Badge>
                  </TableCell>

                  <TableCell className="max-w-xs text-sm">
                    {producto.motivo}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>

      <p className="text-xs text-muted-foreground">
        La demanda se estima con las salidas de ventas registradas en los últimos 30 días. Los resultados dependen de la información disponible en el sistema.
      </p>
    </main>
  )
}