import { useState } from 'react'
import { BarChart3, Info, Loader2, PackageCheck, RefreshCcw } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { OPCIONES_PERIODO, filtroValido, useKpisGenerales } from './kpisGeneralesApi'
import type { FiltroKpis, PeriodoKpi } from './kpisGeneralesApi'

const numero = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 2 })
const moneda = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' })

function fecha(iso: string) {
  const [anio, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${anio}`
}

/**
 * US-34 · Módulo de indicadores del dashboard: rotación de inventario y mermas evitadas
 * del periodo elegido. Cuando faltan datos históricos lo indica en lugar de mostrar ceros.
 */
export function IndicadoresGeneralesPanel() {
  const [filtro, setFiltro] = useState<FiltroKpis>({ periodo: '90d' })
  const consulta = useKpisGenerales(filtro)
  const data = consulta.data
  const rangoIncompleto = !filtroValido(filtro)

  return (
    <section aria-labelledby="titulo-indicadores" className="rounded-xl border bg-white p-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="size-5 text-muted-foreground" aria-hidden />
          <div>
            <h2 id="titulo-indicadores" className="font-semibold">Indicadores de impacto</h2>
            <p className="text-xs text-muted-foreground">Rotación de inventario y mermas evitadas por el sistema.</p>
          </div>
        </div>

        {/* TC-06: selección del periodo de análisis */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="periodo-kpi">Periodo</Label>
            <select
              id="periodo-kpi"
              value={filtro.periodo}
              onChange={(e) => setFiltro({ periodo: e.target.value as PeriodoKpi })}
              className="flex h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus:ring-2 focus:ring-ring"
            >
              {OPCIONES_PERIODO.map((o) => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
            </select>
          </div>
          {filtro.periodo === 'personalizado' && (
            <>
              <div className="space-y-1">
                <Label htmlFor="kpi-desde">Desde</Label>
                <Input id="kpi-desde" type="date" value={filtro.desde ?? ''} max={filtro.hasta || undefined}
                  onChange={(e) => setFiltro({ ...filtro, desde: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="kpi-hasta">Hasta</Label>
                <Input id="kpi-hasta" type="date" value={filtro.hasta ?? ''} min={filtro.desde || undefined}
                  onChange={(e) => setFiltro({ ...filtro, hasta: e.target.value })} />
              </div>
            </>
          )}
        </div>
      </div>

      {rangoIncompleto && (
        <p className="mt-4 text-sm text-muted-foreground">Elige un rango de fechas válido (desde ≤ hasta) para calcular los indicadores.</p>
      )}
      {!rangoIncompleto && consulta.isLoading && (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Calculando indicadores...
        </p>
      )}
      {!rangoIncompleto && consulta.isError && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {consulta.error instanceof Error && consulta.error.message ? consulta.error.message : 'No se pudieron calcular los indicadores.'}
        </p>
      )}

      {!rangoIncompleto && data && (
        <div className="mt-4 space-y-4">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            Periodo analizado: {fecha(data.periodo.desde)} – {fecha(data.periodo.hasta)} ({data.periodo.dias} días)
            {consulta.isFetching && <RefreshCcw className="size-3 animate-spin" aria-label="Actualizando" />}
          </p>

          {/* TC-02 / TC-07: datos insuficientes */}
          {!data.suficiente ? (
            <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="flex items-center gap-2 font-medium"><Info className="size-4" aria-hidden /> No es posible calcular los indicadores de este periodo.</p>
              <p className="mt-1">No hay datos históricos suficientes.</p>
              {data.razones.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                  {data.razones.map((razon) => <li key={razon}>{razon}</li>)}
                </ul>
              )}
              <p className="mt-2 text-xs">Prueba con un periodo más amplio o espera a acumular más historial.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {/* TC-03 */}
              <article className="rounded-xl border p-4" data-testid="kpi-rotacion">
                <p className="text-sm text-muted-foreground">Rotación de inventario</p>
                <p className="mt-2 text-3xl font-semibold">{numero.format(data.rotacion.valor ?? 0)} <span className="text-base font-normal text-muted-foreground">veces</span></p>
                <p className="mt-1 text-sm">
                  {data.rotacion.dias_inventario !== null && <>El inventario se renueva cada <strong>{numero.format(data.rotacion.dias_inventario)} días</strong>. </>}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {data.rotacion.base === 'valorizado'
                    ? `Costo de ventas ${moneda.format(data.rotacion.costo_ventas)} · inventario promedio ${moneda.format(data.rotacion.inventario_promedio_valor)}`
                    : `Calculado en unidades: ${numero.format(data.rotacion.unidades_vendidas)} vendidas · inventario promedio ${numero.format(data.rotacion.inventario_promedio_unidades)}`}
                </p>
              </article>

              {/* TC-04 */}
              <article className="rounded-xl border p-4" data-testid="kpi-mermas">
                <p className="flex items-center gap-1 text-sm text-muted-foreground"><PackageCheck className="size-4" aria-hidden /> Mermas evitadas (estimado)</p>
                <p className="mt-2 text-3xl font-semibold">{moneda.format(data.mermas_evitadas.valor)}</p>
                <p className="mt-1 text-sm">
                  {numero.format(data.mermas_evitadas.unidades)} unidades en {data.mermas_evitadas.lotes} {data.mermas_evitadas.lotes === 1 ? 'lote' : 'lotes'}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {data.mermas_evitadas.alertas === 0
                    ? 'Ninguna alerta de vencimiento fue atendida en el periodo.'
                    : `Según ${data.mermas_evitadas.alertas} ${data.mermas_evitadas.alertas === 1 ? 'alerta atendida' : 'alertas atendidas'}.`}
                </p>
              </article>
            </div>
          )}

          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">¿Cómo se calculan?</summary>
            <p className="mt-1"><strong>Rotación:</strong> {data.metodologia.rotacion}</p>
            <p className="mt-1"><strong>Mermas evitadas:</strong> {data.metodologia.mermas_evitadas}</p>
          </details>
        </div>
      )}
    </section>
  )
}
