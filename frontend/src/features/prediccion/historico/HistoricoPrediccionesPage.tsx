import { useMemo, useState, type FormEvent } from 'react'
import { AlertCircle, Info } from 'lucide-react'
import {
  Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ApiError } from '@/lib/api'
import { useProductos } from '@/features/productos/api'
import { useHistoricoPredicciones, type DetalleComparacion, type FiltrosHistorico, type RespuestaHistorico } from './api'
import { datosGrafico, etiquetaPeriodo, lecturaDiferencia, textoNumero, textoPorcentaje, type PuntoGrafico } from './formato'

const FILAS_POR_PAGINA = 10
const PERIODOS = [
  { dias: 7, etiqueta: 'Semanal (7 días)' },
  { dias: 14, etiqueta: 'Quincenal (14 días)' },
  { dias: 30, etiqueta: 'Mensual (30 días)' },
  { dias: 1, etiqueta: 'Diario' },
]
const FILTROS_INICIALES: FiltrosHistorico = { productoId: '', desde: '', hasta: '', periodoDias: 7 }

// Verde = lo realmente vendido, ámbar = lo que predijo el modelo.
const COLOR_REAL = '#166534'
const COLOR_PREDICCION = '#d97706'

function ayerIso() {
  const ayer = new Date()
  ayer.setDate(ayer.getDate() - 1)
  return [ayer.getFullYear(), String(ayer.getMonth() + 1).padStart(2, '0'), String(ayer.getDate()).padStart(2, '0')].join('-')
}

function Indicador({ titulo, valor, detalle }: { titulo: string; valor: string; detalle?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-sm text-muted-foreground">{titulo}</p>
      <p className="mt-1 text-2xl font-semibold">{valor}</p>
      {detalle && <p className="text-xs text-muted-foreground">{detalle}</p>}
    </div>
  )
}

/** FE-02 / TC-02 / TC-07: aviso cuando no hay datos suficientes para comparar. */
function AvisoSinDatos({ mensaje }: { mensaje: string }) {
  return (
    <div role="status" data-testid="aviso-sin-datos" className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
      <Info className="mt-0.5 size-5 shrink-0" />
      <div>
        <p className="font-medium">No hay datos suficientes para comparar</p>
        <p className="text-sm">{mensaje}</p>
        <p className="mt-1 text-xs">Pruebe con otro producto, un rango de fechas distinto o registre/importe las ventas de ese periodo.</p>
      </div>
    </div>
  )
}

function TooltipComparacion({ active, payload }: { active?: boolean; payload?: { payload: PuntoGrafico }[] }) {
  if (!active || !payload?.length) return null
  const punto = payload[0].payload
  return (
    <div className="rounded-md border bg-background p-3 text-sm shadow-md">
      <p className="font-medium">{punto.etiqueta}</p>
      <p style={{ color: COLOR_REAL }}>Venta real: {textoNumero(punto.venta_real)}</p>
      <p style={{ color: COLOR_PREDICCION }}>Predicción: {textoNumero(punto.prediccion)}</p>
      <p className="text-muted-foreground">Diferencia: {textoPorcentaje(punto.diferencia_pct)}</p>
    </div>
  )
}

/** TC-05: gráfica de barras (venta real) con línea (predicción) por periodo. */
function GraficoComparacion({ datos }: { datos: RespuestaHistorico }) {
  const puntos = useMemo(() => datosGrafico(datos.periodos), [datos.periodos])
  const sinDatos = datos.periodos.filter((periodo) => periodo.estado !== 'ok')
  return (
    <section className="space-y-3 rounded-xl border bg-card p-5" aria-label="Gráfica de predicción contra venta real">
      <div>
        <h2 className="text-lg font-semibold">Predicción vs venta real</h2>
        <p className="text-sm text-muted-foreground">
          Unidades por periodo de {datos.filtros.periodo_dias} día(s). La predicción de cada periodo usa solo lo vendido antes de que empezara.
        </p>
      </div>
      <div className="h-80 w-full" role="img" aria-label="Barras de venta real y línea de predicción por periodo">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={puntos} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="etiqueta" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
            <Tooltip content={<TooltipComparacion />} />
            <Legend />
            <Bar dataKey="venta_real" name="Venta real" fill={COLOR_REAL} radius={[4, 4, 0, 0]} />
            <Line dataKey="prediccion" name="Predicción" stroke={COLOR_PREDICCION} strokeWidth={2.5} dot={{ r: 4 }} connectNulls={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {sinDatos.length > 0 && (
        <div data-testid="periodos-sin-datos" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-medium">Periodos sin datos suficientes ({sinDatos.length})</p>
          <ul className="mt-1 list-disc pl-5">
            {sinDatos.map((periodo) => (
              <li key={periodo.periodo_inicio}>{etiquetaPeriodo(periodo.periodo_inicio, periodo.periodo_fin)}: {periodo.mensaje ?? 'No hay datos suficientes para ese periodo.'}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function varianteLectura(fila: DetalleComparacion) {
  if (fila.diferencia_pct === null) return 'secondary' as const
  const absoluto = Math.abs(fila.diferencia_pct)
  if (absoluto <= 10) return 'bajo' as const
  return absoluto <= 25 ? ('medio' as const) : ('alto' as const)
}

/** TC-03 / TC-04: detalle por producto y periodo con la diferencia porcentual. */
function TablaDetalle({ detalle }: { detalle: DetalleComparacion[] }) {
  const [pagina, setPagina] = useState(1)
  const totalPaginas = Math.max(1, Math.ceil(detalle.length / FILAS_POR_PAGINA))
  const paginaActual = Math.min(pagina, totalPaginas)
  const filas = detalle.slice((paginaActual - 1) * FILAS_POR_PAGINA, paginaActual * FILAS_POR_PAGINA)
  return (
    <section className="space-y-3 rounded-xl border bg-card p-5">
      <h2 className="text-lg font-semibold">Detalle por producto y periodo</h2>
      <div className="overflow-x-auto">
        <Table className="min-w-[760px]">
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead><TableHead>Periodo</TableHead>
              <TableHead className="text-right">Predicción</TableHead><TableHead className="text-right">Venta real</TableHead>
              <TableHead className="text-right">Diferencia</TableHead><TableHead className="text-right">Dif. %</TableHead><TableHead>Lectura</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.map((fila) => (
              <TableRow key={`${fila.producto_id}-${fila.periodo_inicio}`}>
                <TableCell><strong>{fila.producto_nombre}</strong><span className="block text-xs text-muted-foreground">{fila.producto_codigo}</span></TableCell>
                <TableCell>{etiquetaPeriodo(fila.periodo_inicio, fila.periodo_fin)}</TableCell>
                {fila.estado === 'ok' ? (
                  <>
                    <TableCell className="text-right">{textoNumero(fila.prediccion)}</TableCell>
                    <TableCell className="text-right">{textoNumero(fila.venta_real)}</TableCell>
                    <TableCell className="text-right">{textoNumero(fila.diferencia)}</TableCell>
                    <TableCell className="text-right font-medium">{textoPorcentaje(fila.diferencia_pct)}</TableCell>
                    <TableCell><Badge variant={varianteLectura(fila)}>{lecturaDiferencia(fila.diferencia_pct)}</Badge></TableCell>
                  </>
                ) : (
                  <TableCell colSpan={5} className="text-sm text-amber-800">{fila.mensaje ?? 'No hay datos suficientes para ese periodo.'}</TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span>Página {paginaActual} de {totalPaginas} · {detalle.length} comparaciones</span>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" disabled={paginaActual <= 1} onClick={() => setPagina(paginaActual - 1)}>Anterior</Button>
          <Button type="button" variant="outline" size="sm" disabled={paginaActual >= totalPaginas} onClick={() => setPagina(paginaActual + 1)}>Siguiente</Button>
        </div>
      </div>
    </section>
  )
}

/**
 * HU-128 (US-25): el jefe de ventas compara lo que predijo el modelo con lo realmente vendido,
 * por producto y periodo, para evaluar la precisión del modelo.
 */
export default function HistoricoPrediccionesPage() {
  const [formulario, setFormulario] = useState<FiltrosHistorico>(FILTROS_INICIALES)
  const [aplicados, setAplicados] = useState<FiltrosHistorico>(FILTROS_INICIALES)
  const [errorFechas, setErrorFechas] = useState('')

  const { data: productos } = useProductos({ page: 1, pageSize: 500 })
  const consulta = useHistoricoPredicciones(aplicados)
  const datos = consulta.data

  function consultar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (formulario.desde && formulario.hasta && formulario.desde > formulario.hasta) {
      setErrorFechas('La fecha inicial no puede ser posterior a la final.')
      return
    }
    setErrorFechas('')
    setAplicados(formulario)
  }

  function limpiar() {
    setFormulario(FILTROS_INICIALES)
    setAplicados(FILTROS_INICIALES)
    setErrorFechas('')
  }

  const mensajeError = consulta.error instanceof ApiError || consulta.error instanceof Error
    ? consulta.error.message
    : 'No se pudo cargar la comparación.'
  const maximo = ayerIso()

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <div>
        <h1 className="text-2xl font-semibold">Predicciones vs ventas reales</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          US-25: compare lo que el modelo habría predicho con lo realmente vendido para evaluar su precisión.
          Una diferencia positiva significa que el modelo predijo de más; negativa, de menos.
        </p>
      </div>

      <form onSubmit={consultar} className="grid gap-4 rounded-xl border bg-card p-5 md:grid-cols-5">
        <label className="flex flex-col gap-2 text-sm font-medium md:col-span-2">
          Producto
          <select className="w-full rounded-md border bg-background p-2.5" value={formulario.productoId} onChange={(e) => setFormulario({ ...formulario, productoId: e.target.value })}>
            <option value="">Todos los productos con ventas</option>
            {(productos?.results ?? []).map((producto) => (
              <option key={producto.id} value={producto.id}>{producto.codigo} - {producto.nombre}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          Desde
          <input type="date" max={maximo} className="rounded-md border bg-background p-2.5" value={formulario.desde} onChange={(e) => setFormulario({ ...formulario, desde: e.target.value })} />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          Hasta
          <input type="date" max={maximo} className="rounded-md border bg-background p-2.5" value={formulario.hasta} onChange={(e) => setFormulario({ ...formulario, hasta: e.target.value })} />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium">
          Periodo
          <select className="w-full rounded-md border bg-background p-2.5" value={formulario.periodoDias} onChange={(e) => setFormulario({ ...formulario, periodoDias: Number(e.target.value) })}>
            {PERIODOS.map((periodo) => <option key={periodo.dias} value={periodo.dias}>{periodo.etiqueta}</option>)}
          </select>
        </label>
        <div className="flex flex-wrap items-center gap-3 md:col-span-5">
          <Button type="submit" disabled={consulta.isFetching}>{consulta.isFetching ? 'Consultando...' : 'Consultar'}</Button>
          <Button type="button" variant="outline" onClick={limpiar}>Limpiar filtros</Button>
          <span className="text-xs text-muted-foreground">Sin fechas se muestran las últimas 12 semanas hasta ayer.</span>
        </div>
        {errorFechas && <p role="alert" className="text-sm text-red-700 md:col-span-5">{errorFechas}</p>}
      </form>

      {consulta.isLoading && <p role="status">Calculando la comparación...</p>}
      {consulta.isError && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 p-4 text-red-800">
          <AlertCircle className="mt-0.5 size-5 shrink-0" />
          <div>{mensajeError}<button type="button" className="ml-3 underline" onClick={() => void consulta.refetch()}>Reintentar</button></div>
        </div>
      )}

      {datos && (
        <>
          {datos.filtros.hasta_ajustado && (
            <p className="text-sm text-muted-foreground">La fecha final se ajustó a ayer ({datos.filtros.hasta}): solo se comparan días completos.</p>
          )}
          {datos.productos_truncados && (
            <p className="text-sm text-muted-foreground">Se muestran los {datos.max_productos} productos con más ventas. Elija un producto para ver uno en particular.</p>
          )}

          {datos.hay_datos ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Indicador titulo="Precisión del modelo" valor={datos.resumen.precision_pct === null ? '—' : `${textoNumero(datos.resumen.precision_pct)} %`} detalle="100 % - error ponderado" />
                <Indicador titulo="Error ponderado" valor={datos.resumen.error_porcentual_ponderado === null ? '—' : `${textoNumero(datos.resumen.error_porcentual_ponderado)} %`} detalle="Σ|predicción - real| / Σ real" />
                <Indicador titulo="Sesgo" valor={textoPorcentaje(datos.resumen.sesgo_pct)} detalle="Positivo: tiende a predecir de más" />
                <Indicador titulo="Comparaciones" valor={String(datos.resumen.comparaciones)} detalle={`${datos.resumen.sin_datos} sin datos suficientes`} />
              </div>
              <GraficoComparacion datos={datos} />
              <TablaDetalle detalle={datos.detalle} />
            </>
          ) : (
            <AvisoSinDatos mensaje={datos.mensaje ?? 'No hay datos suficientes para comparar en el rango seleccionado.'} />
          )}
          <p className="text-xs text-muted-foreground">
            Modelo {datos.modelo.version} · {datos.modelo.nombre}. Solo cuentan las ventas netas (manuales e importadas).
          </p>
        </>
      )}
    </div>
  )
}
