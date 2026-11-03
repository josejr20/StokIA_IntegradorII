import { useState } from 'react'
import { AlertTriangle, Search, TrendingUp, X } from 'lucide-react'
import { CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api'
import { useProductos } from '@/features/productos/api'
import { usePredecirDemanda } from './api'
import type { Confianza, PrediccionInsuficiente, PrediccionOk, ResultadoPrediccion, Tendencia } from './api'

const MAX_PRODUCTOS = 10
const HORIZONTES = [7, 14, 30]

const formatoNumero = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 })

function formatoFecha(iso: string) {
  const [, mes, dia] = iso.split('-')
  return `${dia}/${mes}`
}

function formatoFechaLarga(iso: string) {
  const [anio, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${anio}`
}

const TEXTO_TENDENCIA: Record<Tendencia, string> = {
  sube: '↑ Ventas en aumento',
  baja: '↓ Ventas en descenso',
  estable: '→ Ventas estables',
}

const TEXTO_CONFIANZA: Record<Confianza, string> = {
  alta: 'Confianza alta',
  media: 'Confianza media',
  baja: 'Confianza baja',
}

// Colores del Badge: verde = confianza alta, ámbar = media, rojo = baja.
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

function datosGrafico(resultado: PrediccionOk): PuntoGrafico[] {
  const historico: PuntoGrafico[] = resultado.serie_historica
    .slice(-28)
    .map((punto) => ({ fecha: punto.fecha, historico: punto.cantidad }))
  const ultimo = historico[historico.length - 1]
  // El último día real también inicia la línea punteada, para que ambas líneas se unan.
  if (ultimo) ultimo.proyeccion = ultimo.historico
  const proyeccion: PuntoGrafico[] = resultado.proyeccion.map((punto) => ({
    fecha: punto.fecha,
    proyeccion: punto.cantidad,
  }))
  return [...historico, ...proyeccion]
}

function TarjetaOk({ resultado, titulo }: { resultado: PrediccionOk; titulo: string }) {
  const { historial } = resultado
  return (
    <div className="space-y-4 rounded-xl border bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="font-semibold">{titulo}</h2>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{TEXTO_TENDENCIA[resultado.tendencia]}</Badge>
          <Badge variant={VARIANTE_CONFIANZA[resultado.confianza]}>{TEXTO_CONFIANZA[resultado.confianza]}</Badge>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Demanda estimada · próximos {resultado.horizonte_dias} días
          </p>
          <p className="mt-1 text-3xl font-semibold">
            {formatoNumero.format(resultado.demanda_estimada)}{' '}
            <span className="text-base font-normal text-muted-foreground">unidades</span>
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Rango probable ({resultado.nivel_intervalo} %)</p>
          <p className="mt-1 text-xl font-medium">
            {formatoNumero.format(resultado.intervalo_inferior)} – {formatoNumero.format(resultado.intervalo_superior)}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Promedio por día</p>
          <p className="mt-1 text-xl font-medium">{formatoNumero.format(resultado.promedio_diario)}</p>
        </div>
      </div>

      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={datosGrafico(resultado)} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="fecha" tickFormatter={formatoFecha} minTickGap={24} tick={{ fontSize: 12 }} />
            <YAxis width={40} tick={{ fontSize: 12 }} />
            <Tooltip
              labelFormatter={(valor: unknown) => formatoFecha(String(valor))}
              formatter={(valor: unknown) => formatoNumero.format(Number(valor))}
            />
            <Legend />
            <Line type="monotone" dataKey="historico" name="Ventas reales" stroke="#2563eb" strokeWidth={2} dot={false} />
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
        Calculado con {historial.dias_analizados} días de ventas ({historial.dias_con_ventas} con movimiento,{' '}
        {formatoNumero.format(historial.unidades)} unidades). Considera el nivel reciente de ventas, la tendencia y
        el día de la semana. Es una estimación: el rango indica dónde es más probable que quede la demanda real.
      </p>
    </div>
  )
}

function TarjetaInsuficiente({ resultado, titulo }: { resultado: PrediccionInsuficiente; titulo: string }) {
  const { historial, requisitos } = resultado
  return (
    <div role="status" className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-5">
      <div className="flex items-center gap-2">
        <AlertTriangle className="text-amber-600" />
        <h2 className="font-semibold">{titulo}</h2>
      </div>
      <p className="text-sm">{resultado.mensaje}</p>
      <p className="text-xs text-muted-foreground">
        Días con ventas: {historial.dias_con_ventas} de {requisitos.min_dias_con_ventas} necesarios · Historial:{' '}
        {historial.dias_analizados} de {requisitos.min_dias_historial} días necesarios. Registra o importa más
        ventas para poder predecir.
      </p>
    </div>
  )
}

function TarjetaResultado({ resultado }: { resultado: ResultadoPrediccion }) {
  const titulo = resultado.producto
    ? `${resultado.producto.codigo} · ${resultado.producto.nombre}`
    : `Producto ${resultado.producto_id}`

  if (resultado.estado === 'ok') return <TarjetaOk resultado={resultado} titulo={titulo} />
  if (resultado.estado === 'datos_insuficientes') return <TarjetaInsuficiente resultado={resultado} titulo={titulo} />
  return (
    <div role="alert" className="rounded-xl border border-destructive/40 bg-white p-5 text-sm">
      <h2 className="font-semibold">{titulo}</h2>
      <p className="mt-1 text-destructive">{resultado.mensaje}</p>
    </div>
  )
}

export default function PrediccionPage() {
  const [buscar, setBuscar] = useState('')
  const [elegidos, setElegidos] = useState<ProductoElegido[]>([])
  const [horizonte, setHorizonte] = useState(7)

  const catalogo = useProductos({})
  const prediccion = usePredecirDemanda()

  const texto = buscar.trim().toLowerCase()
  const productos = (catalogo.data?.results ?? [])
    .filter((producto) => producto.activo)
    .filter((producto) => !texto || `${producto.codigo} ${producto.nombre}`.toLowerCase().includes(texto))

  const estaElegido = (id: number) => elegidos.some((producto) => producto.id === id)
  const limiteAlcanzado = elegidos.length >= MAX_PRODUCTOS

  function alternar(producto: ProductoElegido) {
    setElegidos((actuales) => {
      if (actuales.some((actual) => actual.id === producto.id)) {
        return actuales.filter((actual) => actual.id !== producto.id)
      }
      return actuales.length >= MAX_PRODUCTOS ? actuales : [...actuales, producto]
    })
  }

  function generar() {
    prediccion.mutate({ productoIds: elegidos.map((producto) => producto.id), horizonteDias: horizonte })
  }

  const mensajeError =
    prediccion.error instanceof ApiError ? prediccion.error.message : 'No se pudo generar la predicción.'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <TrendingUp /> Predicción de demanda
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Estima cuánto se venderá de cada producto a partir de su historial de ventas, para anticipar cuánto comprar
          o producir.
        </p>
      </div>

      <div className="space-y-4 rounded-xl border bg-white p-5">
        <div>
          <h2 className="font-medium">1. Elige los productos a analizar</h2>
          <p className="text-sm text-muted-foreground">Hasta {MAX_PRODUCTOS} productos a la vez.</p>
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

        {catalogo.isLoading && <p className="text-sm text-muted-foreground">Cargando productos...</p>}
        {catalogo.isError && <p className="text-sm text-destructive">No se pudieron cargar los productos.</p>}
        {!catalogo.isLoading && !catalogo.isError && productos.length === 0 && (
          <p className="text-sm text-muted-foreground">No hay productos que coincidan con la búsqueda.</p>
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
                    onChange={() => alternar({ id: producto.id, codigo: producto.codigo, nombre: producto.nombre })}
                  />
                  <span className="font-mono text-xs text-muted-foreground">{producto.codigo}</span>
                  <span className="truncate">{producto.nombre}</span>
                </label>
              </li>
            ))}
          </ul>
        )}

        {elegidos.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {elegidos.map((producto) => (
              <Badge key={producto.id} variant="outline" className="gap-1">
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
          <p className="text-xs text-muted-foreground">Llegaste al máximo de {MAX_PRODUCTOS} productos.</p>
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
          <Button type="button" onClick={generar} disabled={elegidos.length === 0 || prediccion.isPending}>
            {prediccion.isPending ? 'Calculando...' : 'Generar predicción'}
          </Button>
        </div>
      </div>

      {prediccion.isError && (
        <div role="alert" className="rounded-xl border border-destructive/40 bg-white p-4 text-sm text-destructive">
          {mensajeError}
        </div>
      )}

      {prediccion.data && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Resultados según las ventas registradas hasta el {formatoFechaLarga(prediccion.data.ultimo_dia_analizado)}.
          </p>
          {prediccion.data.resultados.map((resultado) => (
            <TarjetaResultado key={resultado.producto_id} resultado={resultado} />
          ))}
        </div>
      )}

      {!prediccion.data && !prediccion.isPending && !prediccion.isError && (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          Elige uno o más productos y pulsa «Generar predicción» para ver la demanda estimada.
        </div>
      )}
    </div>
  )
}
