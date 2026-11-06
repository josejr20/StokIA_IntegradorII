import { useState } from 'react'
import { AlertTriangle, Search, TrendingUp, X } from 'lucide-react'
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { api, ApiError } from '@/lib/api'
import { useAuth } from '@/auth/AuthContext'
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
import { usePredecirDemanda } from './api'
import type {
  Confianza,
  PrediccionInsuficiente,
  PrediccionOk,
  ResultadoPrediccion,
  Tendencia,
} from './api'

const MAX_PRODUCTOS = 10
const HORIZONTES = [7, 14, 30]
const LIMITE_ALERTAS_POR_EJECUCION = 10

const formatoNumero = new Intl.NumberFormat('es-PE', {
  maximumFractionDigits: 1,
})

function formatoFecha(iso: string) {
  const [, mes, dia] = iso.split('-')
  return `${dia}/${mes}`
}

const fechaHoy = () => {
  const fecha = new Date()

  return [
    fecha.getFullYear(),
    String(fecha.getMonth() + 1).padStart(2, '0'),
    String(fecha.getDate()).padStart(2, '0'),
  ].join('-')
function formatoFechaLarga(iso: string) {
  const [anio, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${anio}`
}

const TEXTO_TENDENCIA: Record<Tendencia, string> = {
  sube: '↑ Ventas en aumento',
  baja: '↓ Ventas en descenso',
  estable: '→ Ventas estables',
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

  const stock = Math.max(
    0,
    Number(producto.stock_total ?? 0),
  )

  const inicioPeriodo = `${fechaHace30Dias()}T00:00:00`
  const finPeriodo = `${fechaHoy()}T23:59:59`
const TEXTO_CONFIANZA: Record<Confianza, string> = {
  alta: 'Confianza alta',
  media: 'Confianza media',
  baja: 'Confianza baja',
}

const VARIANTE_CONFIANZA: Record<Confianza, 'bajo' | 'medio' | 'alto'> = {
  alta: 'bajo',
  media: 'medio',
  baja: 'alto',
}

interface ProductoElegido {
  id: number
  codigo: string
  nombre: string
}

interface PuntoGrafico {
  fecha: string
  historico?: number
  proyeccion?: number
}

    const fechaMovimiento = movimiento.fecha

    return (
      fechaMovimiento >= inicioPeriodo &&
      fechaMovimiento <= finPeriodo
    )
  })

  const demanda30 = salidas.reduce(
    (total, movimiento) =>
      total + Math.max(
        0,
        Number(movimiento.cantidad ?? 0),
      ),
    0,
  )
type AnomaliaDetectada = {
  fuente: 'venta' | 'movimiento'
  registro_id: number | string
  producto_id: number | string
  cantidad: number | string
  fecha: string
  origen?: string
  motivo?: string
}

type ResultadoAnomalias = {
  modo: 'vista_previa' | 'registro'
  rango_desde: string
  rango_hasta: string
  ventas_consultadas: number
  movimientos_consultados: number
  anomalias_encontradas: number
  muestra_anomalias: AnomaliaDetectada[]
  muestra_truncada: boolean
  alertas_creadas: number
  alertas_ya_existentes: number
  pendientes_por_limite: number
}

function datosGrafico(resultado: PrediccionOk): PuntoGrafico[] {
  const historico: PuntoGrafico[] = resultado.serie_historica
    .slice(-28)
    .map((punto) => ({
      fecha: punto.fecha,
      historico: punto.cantidad,
    }))

  const diasCobertura =
    demandaDiaria > 0
      ? stock / demandaDiaria
      : null

  const diasVencer = lotesProducto.reduce<number | null>(
    (minimo, lote) => {
      if (!lote.fecha_vencimiento) return minimo
  const ultimo = historico[historico.length - 1]
  if (ultimo) ultimo.proyeccion = ultimo.historico

  const proyeccion: PuntoGrafico[] = resultado.proyeccion.map((punto) => ({
    fecha: punto.fecha,
    proyeccion: punto.cantidad,
  }))

  return [...historico, ...proyeccion]
}

      if (Number.isNaN(vencimiento.getTime())) {
        return minimo
      }

      const hoy = new Date(`${fechaHoy()}T00:00:00`)

      const dias = Math.ceil(
        (vencimiento.getTime() - hoy.getTime()) /
          86400000,
      )

      return minimo === null
        ? dias
        : Math.min(minimo, dias)
    },
    null,
function TarjetaOk({
  resultado,
  titulo,
}: {
  resultado: PrediccionOk
  titulo: string
}) {
  const { historial } = resultado

  return (
    <div className="space-y-4 rounded-xl border bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="font-semibold">{titulo}</h2>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">
            {TEXTO_TENDENCIA[resultado.tendencia]}
          </Badge>
          <Badge variant={VARIANTE_CONFIANZA[resultado.confianza]}>
            {TEXTO_CONFIANZA[resultado.confianza]}
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Demanda estimada · próximos {resultado.horizonte_dias} días
          </p>
          <p className="mt-1 text-3xl font-semibold">
            {formatoNumero.format(resultado.demanda_estimada)}{' '}
            <span className="text-base font-normal text-muted-foreground">
              unidades
            </span>
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">
            Rango probable ({resultado.nivel_intervalo} %)
          </p>
          <p className="mt-1 text-xl font-medium">
            {formatoNumero.format(resultado.intervalo_inferior)} –{' '}
            {formatoNumero.format(resultado.intervalo_superior)}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Promedio por día</p>
          <p className="mt-1 text-xl font-medium">
            {formatoNumero.format(resultado.promedio_diario)}
          </p>
        </div>
      </div>

      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={datosGrafico(resultado)}
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="fecha"
              tickFormatter={formatoFecha}
              minTickGap={24}
              tick={{ fontSize: 12 }}
            />
            <YAxis width={40} tick={{ fontSize: 12 }} />
            <Tooltip
              labelFormatter={(valor: unknown) =>
                formatoFecha(String(valor))
              }
              formatter={(valor: unknown) =>
                formatoNumero.format(Number(valor))
              }
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="historico"
              name="Ventas reales"
              stroke="#2563eb"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="proyeccion"
              name="Estimación"
              stroke="#f59e0b"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p className="text-sm">{resultado.mensaje}</p>
      <p className="text-xs text-muted-foreground">
        Calculado con {historial.dias_analizados} días de ventas (
        {historial.dias_con_ventas} con movimiento,{' '}
        {formatoNumero.format(historial.unidades)} unidades). Considera el nivel
        reciente de ventas, la tendencia y el día de la semana. Es una
        estimación: el rango indica dónde es más probable que quede la demanda
        real.
      </p>
    </div>
  )
}

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
    motivos.push(
      'Sin ventas registradas en 30 días',
    )
  }

  if (
    diasCobertura !== null &&
    diasCobertura < 7
  ) {
    motivos.push(
      'Stock para menos de 7 días de demanda',
    )
  }

  let prioridad: NivelPrioridad

  if (
    (riesgoVencimiento && bajaRotacion) ||
    stock <= 0 ||
    (
      riesgoVencimiento &&
      diasCobertura !== null &&
      diasCobertura < 7
    )
  ) {
    prioridad = 'Alta'
  } else if (
    riesgoVencimiento ||
    bajaRotacion ||
    (
      diasCobertura !== null &&
      diasCobertura < 14
    )
  ) {
    prioridad = 'Media'
  } else {
    prioridad = 'Baja'
function TarjetaInsuficiente({
  resultado,
  titulo,
}: {
  resultado: PrediccionInsuficiente
  titulo: string
}) {
  const { historial, requisitos } = resultado

  return (
    <div
      role="status"
      className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-5"
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="text-amber-600" />
        <h2 className="font-semibold">{titulo}</h2>
      </div>
      <p className="text-sm">{resultado.mensaje}</p>
      <p className="text-xs text-muted-foreground">
        Días con ventas: {historial.dias_con_ventas} de{' '}
        {requisitos.min_dias_con_ventas} necesarios · Historial:{' '}
        {historial.dias_analizados} de {requisitos.min_dias_historial} días
        necesarios. Registra o importa más ventas para poder predecir.
      </p>
    </div>
  )
}

function TarjetaResultado({
  resultado,
}: {
  resultado: ResultadoPrediccion
}) {
  const titulo = resultado.producto
    ? `${resultado.producto.codigo} · ${resultado.producto.nombre}`
    : `Producto ${resultado.producto_id}`

  if (resultado.estado === 'ok') {
    return <TarjetaOk resultado={resultado} titulo={titulo} />
  }
  if (resultado.estado === 'datos_insuficientes') {
    return <TarjetaInsuficiente resultado={resultado} titulo={titulo} />
  }

  return (
    <div
      role="alert"
      className="rounded-xl border border-destructive/40 bg-white p-5 text-sm"
    >
      <h2 className="font-semibold">{titulo}</h2>
      <p className="mt-1 text-destructive">{resultado.mensaje}</p>
    </div>
  )
}

function mostrarNumero(valor: string | number) {
  const numero = Number(valor)
  return Number.isFinite(numero)
    ? numero.toLocaleString('es-PE', { maximumFractionDigits: 2 })
    : String(valor)
}

export default function PrediccionPage() {

  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] =
    useState<FiltroPrioridad>('Todas')

  const {
    data: productosData,
    isLoading: cargandoProductos,
    isError: errorProductos,
    refetch: recargarProductos,
  } = useProductos({
    page: 1,
    pageSize: 100,
    allPages: true,
  })

  const {
    data: lotesData,
    isLoading: cargandoLotes,
    isError: errorLotes,
    refetch: recargarLotes,
  } = useLotes({
    pageSize: 100,
  })

  const {
    data: movimientosData,
    isLoading: cargandoMovimientos,
    isError: errorMovimientos,
    refetch: recargarMovimientos,
  } = useMovimientosInventario({
    fecha_desde: fechaHace30Dias(),
    fecha_hasta: fechaHoy(),
    pageSize: 100,
    allPages: true,
  })

  const filas = useMemo(() => {
    const productos = productosData?.results ?? []
    const lotes = lotesData?.results ?? []
    const movimientos = movimientosData?.results ?? []

    return productos
      .filter((producto) => producto.activo)
      .map((producto) =>
        evaluarPrioridad(
          producto,
          lotes,
          movimientos,
        ),
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
  }, [
    productosData,
    lotesData,
    movimientosData,
  ])

  const visibles = filas.filter((producto) => {
    const texto =
      `${producto.nombre} ${producto.codigo}`.toLowerCase()

    const coincideBusqueda = texto.includes(
      busqueda.trim().toLowerCase(),
    )

    const coincideFiltro =
      filtro === 'Todas' ||
      producto.prioridad === filtro
  const [buscar, setBuscar] = useState('')
  const [elegidos, setElegidos] = useState<ProductoElegido[]>([])
  const [horizonte, setHorizonte] = useState(7)
  const [diasHistorial, setDiasHistorial] = useState(180)
  const [consultandoAnomalias, setConsultandoAnomalias] = useState(false)
  const [registrandoAnomalias, setRegistrandoAnomalias] = useState(false)
  const [vistaAnomalias, setVistaAnomalias] =
    useState<ResultadoAnomalias | null>(null)
  const [resultadoRegistro, setResultadoRegistro] =
    useState<ResultadoAnomalias | null>(null)
  const [errorAnomalias, setErrorAnomalias] = useState('')
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false)
  const [textoConfirmacion, setTextoConfirmacion] = useState('')

  const { usuario, tienePermiso } = useAuth()
  const puedeVerAnomalias = tienePermiso('ver_alertas')
  const esAdministrador =
    String(usuario?.rol_nombre ?? usuario?.rol ?? '')
      .trim()
      .toLocaleLowerCase('es-PE') === 'administrador'
  const registroHabilitado =
    import.meta.env.VITE_HABILITAR_REGISTRO_ANOMALIAS === 'true'

  const catalogo = useProductos({})
  const prediccion = usePredecirDemanda()
  const textoBusqueda = buscar.trim().toLowerCase()
  const productos = (catalogo.data?.results ?? [])
    .filter((producto) => producto.activo)
    .filter(
      (producto) =>
        !textoBusqueda ||
        `${producto.codigo} ${producto.nombre}`
          .toLowerCase()
          .includes(textoBusqueda),
    )

  const estaElegido = (id: number) =>
    elegidos.some((producto) => producto.id === id)
  const limiteAlcanzado = elegidos.length >= MAX_PRODUCTOS

  function alternar(producto: ProductoElegido) {
    setElegidos((actuales) => {
      if (actuales.some((actual) => actual.id === producto.id)) {
        return actuales.filter((actual) => actual.id !== producto.id)
      }
      return actuales.length >= MAX_PRODUCTOS
        ? actuales
        : [...actuales, producto]
    })
  }

  function generar() {
    prediccion.mutate({
      productoIds: elegidos.map((producto) => producto.id),
      horizonteDias: horizonte,
    })
  }

  const altas = filas.filter(
    (p) => p.prioridad === 'Alta',
  ).length

  const medias = filas.filter(
    (p) => p.prioridad === 'Media',
  ).length

  const bajas = filas.filter(
    (p) => p.prioridad === 'Baja',
  ).length

  const cargando =
    cargandoProductos ||
    cargandoLotes ||
    cargandoMovimientos

  const hayError =
    errorProductos ||
    errorLotes ||
    errorMovimientos
  async function analizarAnomalias() {
    if (!puedeVerAnomalias || consultandoAnomalias || registrandoAnomalias) {
      return
    }

    setConsultandoAnomalias(true)
    setErrorAnomalias('')
    setVistaAnomalias(null)
    setResultadoRegistro(null)
    setMostrarConfirmacion(false)
    setTextoConfirmacion('')

    try {
      const respuesta = await api.get<ResultadoAnomalias>(
        `/alertas/anomalias-local/vista-previa?diasHistorial=${diasHistorial}`,
      )
      setVistaAnomalias(respuesta)
    } catch {
      setErrorAnomalias(
        'No se pudo analizar el historial. Comprueba la conexión y tus permisos.',
      )
    } finally {
      setConsultandoAnomalias(false)
    }
  }

  async function registrarAnomaliasConfirmadas() {
    if (
      !esAdministrador ||
      !registroHabilitado ||
      !vistaAnomalias ||
      vistaAnomalias.anomalias_encontradas === 0 ||
      textoConfirmacion !== 'REGISTRAR' ||
      registrandoAnomalias ||
      consultandoAnomalias
    ) {
      return
    }

    setRegistrandoAnomalias(true)
    setErrorAnomalias('')
    try {
      const respuesta = await api.post<ResultadoAnomalias>(
        '/alertas/anomalias-local/evaluar',
        {
          confirmar: true,
          diasHistorial,
          limiteNuevas: LIMITE_ALERTAS_POR_EJECUCION,
        },
      )
      setResultadoRegistro(respuesta)
      setMostrarConfirmacion(false)
      setTextoConfirmacion('')
    } catch {
      setErrorAnomalias(
        'No se pudieron registrar las alertas. No repitas el envío sin comprobar el estado.',
      )
    } finally {
      setRegistrandoAnomalias(false)
    }
  }

  const mensajeError =
    prediccion.error instanceof ApiError
      ? prediccion.error.message
      : 'No se pudo generar la predicción.'

  return (
    <main className="space-y-6 p-4 md:p-6">

      {/* Encabezado del módulo */}
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Priorización de inventario
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Identifica los productos que requieren mayor
            atención según stock, demanda y riesgo de
            vencimiento.
    <main className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <TrendingUp /> Predicción de demanda
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Estima cuánto se venderá de cada producto a partir de su historial de
          ventas, para anticipar cuánto comprar o producir.
        </p>
      </div>

      <div className="space-y-4 rounded-xl border bg-white p-5">
        <div>
          <h2 className="font-medium">1. Elige los productos a analizar</h2>
          <p className="text-sm text-muted-foreground">
            Hasta {MAX_PRODUCTOS} productos a la vez.
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por código o nombre"
            value={buscar}
            onChange={(evento) => setBuscar(evento.target.value)}
          />
        </div>

        {catalogo.isLoading && (
          <p className="text-sm text-muted-foreground">Cargando productos...</p>
        )}
        {catalogo.isError && (
          <p className="text-sm text-destructive">
            No se pudieron cargar los productos.
          </p>
        )}
        {!catalogo.isLoading &&
          !catalogo.isError &&
          productos.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No hay productos que coincidan con la búsqueda.
            </p>
          )}

        {productos.length > 0 && (
          <ul className="max-h-64 divide-y overflow-y-auto rounded-md border">
            {productos.map((producto) => (
              <li key={producto.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted">
                  <input
                    type="checkbox"
                    checked={estaElegido(producto.id)}
                    disabled={!estaElegido(producto.id) && limiteAlcanzado}
                    onChange={() =>
                      alternar({
                        id: producto.id,
                        codigo: producto.codigo,
                        nombre: producto.nombre,
                      })
                    }
                  />
                  <span className="font-mono text-xs text-muted-foreground">
                    {producto.codigo}
                  </span>
                  <span className="truncate">{producto.nombre}</span>
                </label>
              </li>
            ))}
          </ul>
        )}

        {elegidos.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {elegidos.map((producto) => (
              <Badge
                key={producto.id}
                variant="outline"
                className="gap-1"
              >
                {producto.codigo}
                <button
                  type="button"
                  aria-label={`Quitar ${producto.nombre}`}
                  onClick={() => alternar(producto)}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        {limiteAlcanzado && (
          <p className="text-xs text-muted-foreground">
            Llegaste al máximo de {MAX_PRODUCTOS} productos.
          </p>
        )}

        <div className="flex flex-wrap items-end gap-6">
          <div>
            <h2 className="mb-2 font-medium">2. Periodo a predecir</h2>
            <div className="flex gap-2">
              {HORIZONTES.map((dias) => (
                <Button
                  key={dias}
                  type="button"
                  size="sm"
                  variant={horizonte === dias ? 'default' : 'outline'}
                  onClick={() => setHorizonte(dias)}
                >
                  {dias} días
                </Button>
              ))}
            </div>
          </div>
          <Button
            type="button"
            onClick={generar}
            disabled={elegidos.length === 0 || prediccion.isPending}
          >
            {prediccion.isPending ? 'Calculando...' : 'Generar predicción'}
          </Button>
        </div>
      </div>

      {/* Mensaje de error */}
      {hayError && (
      {prediccion.isError && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/40 bg-white p-4 text-sm text-destructive"
        >
          No se pudieron cargar todos los datos del
          inventario.
        </div>
      )}

      {/* Resumen de prioridades */}
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
          {mensajeError}
        </div>
      )}

      {prediccion.data && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Resultados según las ventas registradas hasta el{' '}
            {formatoFechaLarga(prediccion.data.ultimo_dia_analizado)}.
          </p>
          {prediccion.data.resultados.map((resultado) => (
            <TarjetaResultado
              key={resultado.producto_id}
              resultado={resultado}
            />
          ))}
        </div>
      )}

      {!prediccion.data &&
        !prediccion.isPending &&
        !prediccion.isError && (
          <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
            Elige uno o más productos y pulsa «Generar predicción» para ver la
            demanda estimada.
          </div>

          <p className="mt-2 text-3xl font-semibold text-amber-900">
            {medias}
          </p>

          <p className="mt-1 text-xs text-amber-800">
            Requieren seguimiento
          </p>
        </div>
        )}

      {puedeVerAnomalias && (
        <section
          className="space-y-4 rounded-xl border p-4 md:p-5"
          aria-label="Detector de anomalías US-22"
        >
          <div>
            <h2 className="text-lg font-semibold">
              Detección de anomalías en ventas e inventario
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Consulta movimientos y ventas con cantidades inusuales. La vista
              previa no guarda registros ni modifica el inventario.
            </p>
          </div>

          <p className="mt-2 text-3xl font-semibold text-green-900">
            {bajas}
          </p>

          <p className="mt-1 text-xs text-green-800">
            Situación estable
          </p>
        </div>

      </section>

      {/* Búsqueda y filtros */}
      <section className="flex flex-col gap-3 sm:flex-row">

        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

          <Input
            className="pl-9"
            placeholder="Buscar por nombre o código..."
            value={busqueda}
            onChange={(event) =>
              setBusqueda(event.target.value)
            }
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {(
            ['Todas', 'Alta', 'Media', 'Baja'] as const
          ).map((nivel) => (
            <Button
              key={nivel}
              size="sm"
              variant={
                filtro === nivel
                  ? 'default'
                  : 'outline'
              }
              onClick={() => setFiltro(nivel)}
            >
              {nivel}
            </Button>
          ))}
        </div>

      </section>

      {/* Tabla de productos priorizados */}
      <section className="overflow-x-auto rounded-xl border">

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>
                Demanda estimada (30 días)
              </TableHead>
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

                  <TableCell>
                    {producto.stock}
                  </TableCell>

                  <TableCell>
                    {producto.demanda30}
                  </TableCell>

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
                    <Badge
                      className={
                        estilosPrioridad[producto.prioridad]
                      }
                    >
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

          <div className="flex flex-wrap items-end gap-3">
            <label
              className="flex flex-col gap-1 text-sm"
              htmlFor="dias-anomalias"
            >
              <span>Días de historial</span>
              <select
                id="dias-anomalias"
                className="h-9 rounded-md border bg-background px-3"
                value={diasHistorial}
                disabled={consultandoAnomalias || registrandoAnomalias}
                onChange={(event) => {
                  setDiasHistorial(Number(event.target.value))
                  setVistaAnomalias(null)
                  setResultadoRegistro(null)
                  setMostrarConfirmacion(false)
                  setTextoConfirmacion('')
                  setErrorAnomalias('')
                }}
              >
                <option value={30}>30 días</option>
                <option value={90}>90 días</option>
                <option value={180}>180 días</option>
                <option value={365}>365 días</option>
              </select>
            </label>
            <Button
              type="button"
              variant="outline"
              disabled={consultandoAnomalias || registrandoAnomalias}
              onClick={() => void analizarAnomalias()}
            >
              <Search className="mr-2 size-4" />
              {consultandoAnomalias ? 'Analizando...' : 'Analizar anomalías'}
            </Button>
          </div>

          {errorAnomalias && (
            <p
              role="alert"
              className="rounded-md border border-red-200 p-3 text-sm text-red-700"
            >
              {errorAnomalias}
            </p>
          )}

          {vistaAnomalias && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">
                    Ventas consultadas
                  </p>
                  <p className="text-2xl font-semibold">
                    {vistaAnomalias.ventas_consultadas}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">
                    Movimientos consultados
                  </p>
                  <p className="text-2xl font-semibold">
                    {vistaAnomalias.movimientos_consultados}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">
                    Anomalías detectadas
                  </p>
                  <p className="text-2xl font-semibold">
                    {vistaAnomalias.anomalias_encontradas}
                  </p>
                </div>
              </div>

              {vistaAnomalias.anomalias_encontradas === 0 ? (
                <p role="status" className="text-sm text-muted-foreground">
                  No se encontraron anomalías en este periodo.
                </p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Muestra de hasta 10 registros. Un movimiento y una venta
                    relacionados pueden aparecer como dos anomalías distintas.
                    Esta vista previa no registra alertas.
                  </p>
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Origen</TableHead>
                          <TableHead>Registro</TableHead>
                          <TableHead>Producto</TableHead>
                          <TableHead>Cantidad</TableHead>
                          <TableHead>Motivo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {vistaAnomalias.muestra_anomalias
                          .slice(0, 10)
                          .map((anomalia, indice) => (
                            <TableRow
                              key={`${anomalia.fuente}-${anomalia.registro_id}-${indice}`}
                            >
                              <TableCell>
                                {anomalia.fuente === 'venta'
                                  ? 'Venta'
                                  : 'Movimiento'}
                              </TableCell>
                              <TableCell>#{anomalia.registro_id}</TableCell>
                              <TableCell>#{anomalia.producto_id}</TableCell>
                              <TableCell>
                                {mostrarNumero(anomalia.cantidad)}
                              </TableCell>
                              <TableCell>
                                {anomalia.motivo ?? 'Cantidad inusual'}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}

              {esAdministrador && (
                <div className="space-y-3 rounded-lg border p-3">
                  <h3 className="font-medium">
                    Registro de alertas (solo administrador)
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Registrar SÍ escribe nuevas alertas en la base conectada,
                    con un máximo de {LIMITE_ALERTAS_POR_EJECUCION} por
                    ejecución. No elimina ni modifica ventas. No lo uses en una
                    base compartida para hacer pruebas.
                  </p>

                  {!registroHabilitado ? (
                    <p className="text-sm text-amber-700">
                      Registro deshabilitado por seguridad. Solo debe
                      habilitarse después de verificar una base de pruebas
                      aislada.
                    </p>
                  ) : !mostrarConfirmacion ? (
                    <Button
                      type="button"
                      disabled={
                        vistaAnomalias.anomalias_encontradas === 0 ||
                        registrandoAnomalias
                      }
                      onClick={() => {
                        setMostrarConfirmacion(true)
                        setTextoConfirmacion('')
                      }}
                    >
                      Preparar registro de alertas
                    </Button>
                  ) : (
                    <div className="space-y-3 rounded-lg border p-3">
                      <p className="text-sm font-medium">
                        Esta acción guardará alertas en la base de datos
                        conectada. Para confirmar, escribe REGISTRAR en el
                        campo siguiente.
                      </p>
                      <Input
                        aria-label="Confirmar registro de anomalías"
                        placeholder="Escribe REGISTRAR"
                        value={textoConfirmacion}
                        disabled={registrandoAnomalias}
                        onChange={(event) =>
                          setTextoConfirmacion(event.target.value)
                        }
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          disabled={
                            registrandoAnomalias ||
                            textoConfirmacion !== 'REGISTRAR'
                          }
                          onClick={() =>
                            void registrarAnomaliasConfirmadas()
                          }
                        >
                          {registrandoAnomalias
                            ? 'Registrando...'
                            : 'Confirmar y registrar'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={registrandoAnomalias}
                          onClick={() => {
                            setMostrarConfirmacion(false)
                            setTextoConfirmacion('')
                          }}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {resultadoRegistro && (
            <p role="status" className="rounded-lg border p-3 text-sm">
              Registro finalizado: {resultadoRegistro.alertas_creadas} alerta(s)
              nueva(s), {resultadoRegistro.alertas_ya_existentes} ya
              existente(s) y {resultadoRegistro.pendientes_por_limite} pendiente(s)
              por el límite. Puedes revisar la campanita de notificaciones.
            </p>
          )}
        </section>
      )}

      {/* Información de la evaluación */}
      <p className="text-xs text-muted-foreground">
        La demanda se estima con las salidas de ventas
        registradas en los últimos 30 días. Los resultados
        dependen de la información disponible en el sistema.
        La demanda se estima con las salidas de ventas registradas en los
        últimos 30 días. Los resultados dependen de la información disponible
        en el sistema.
      </p>

    </main>
  )
}
