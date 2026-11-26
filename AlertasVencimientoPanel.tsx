import { AlertTriangle, CheckCircle2, Loader2, RefreshCcw } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api'
import { useAlertasVencimientoRealtime } from '@/lib/socket'
import { useAlertasVencimiento, useAtenderAlerta } from './alertasVencimientoApi'
import type { AlertaVencimiento } from './alertasVencimientoApi'

const formatoNumero = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 })

function formatoFecha(iso: string) {
  const [anio, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${anio}`
}

function textoPlazo(alerta: AlertaVencimiento) {
  if (alerta.fecha_vencimiento === null || alerta.dias_para_vencer === null) return 'Sin fecha de vencimiento'
  const fecha = formatoFecha(alerta.fecha_vencimiento)
  if (alerta.dias_para_vencer < 0) return `${fecha} · vencido`
  if (alerta.dias_para_vencer === 0) return `${fecha} · vence hoy`
  const dias = alerta.dias_para_vencer
  return `${fecha} · en ${dias} ${dias === 1 ? 'día' : 'días'}`
}

/**
 * US-29 · Alertas de riesgo de vencimiento en el dashboard.
 *  - Riesgo alto destacado (rojo) con producto, lote y motivo.
 *  - Botón para marcar como atendida.
 *  - Se actualiza en tiempo real y avisa cuando no hay alertas activas.
 */
export function AlertasVencimientoPanel() {
  useAlertasVencimientoRealtime()
  const consulta = useAlertasVencimiento()
  const atender = useAtenderAlerta()
  const data = consulta.data

  function marcarAtendida(alerta: AlertaVencimiento) {
    atender.mutate(alerta.id, {
      onSuccess: () => toast.success(`Alerta atendida: ${alerta.producto.nombre ?? 'producto'} · lote ${alerta.lote.numero ?? '—'}`),
      onError: (error) => {
        toast.error(error instanceof ApiError ? error.message : 'No se pudo marcar la alerta como atendida')
      },
    })
  }

  const hayAlertas = !!data && data.hay_alertas

  return (
    <section
      aria-labelledby="titulo-alertas-vencimiento"
      className={`rounded-xl border bg-white p-5 ${hayAlertas ? 'border-red-300 shadow-sm' : ''}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className={`size-5 ${hayAlertas ? 'text-red-600' : 'text-muted-foreground'}`} aria-hidden />
          <h2 id="titulo-alertas-vencimiento" className="font-semibold">Alertas de riesgo de vencimiento</h2>
          {hayAlertas && <Badge variant="alto" aria-label={`${data.total} alertas activas`}>{data.total}</Badge>}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void consulta.refetch()}
          disabled={consulta.isFetching}
          aria-label="Actualizar alertas"
        >
          <RefreshCcw className={consulta.isFetching ? 'animate-spin' : ''} />
          Actualizar
        </Button>
      </div>

      {consulta.isLoading && (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Evaluando riesgo de vencimiento...
        </p>
      )}

      {consulta.isError && !data && (
        <p role="alert" className="mt-4 text-sm text-destructive">No se pudieron cargar las alertas de vencimiento.</p>
      )}

      {data && !data.sincronizado && (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          No se pudo recalcular el riesgo ahora; se muestra el último estado guardado.
        </p>
      )}

      {/* TC-02 / TC-07: sin alertas activas */}
      {data && !data.hay_alertas && (
        <p role="status" className="mt-4 flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden />
          No hay alertas activas de riesgo de vencimiento.
        </p>
      )}

      {/* TC-01 / TC-03 / TC-04: riesgo alto destacado con producto, lote y motivo */}
      {hayAlertas && (
        <ul className="mt-4 space-y-3" aria-live="polite">
          {data.alertas.map((alerta) => {
            const enProceso = atender.isPending && atender.variables === alerta.id
            return (
              <li
                key={alerta.id}
                data-testid="alerta-vencimiento"
                className="flex flex-col gap-3 rounded-lg border border-l-4 border-red-200 border-l-red-600 bg-red-50 p-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 space-y-1 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="alto">Riesgo alto</Badge>
                    <span className="font-semibold">{alerta.producto.nombre ?? `Producto ${alerta.producto.id}`}</span>
                    {alerta.producto.codigo && <span className="text-muted-foreground">({alerta.producto.codigo})</span>}
                  </div>
                  <p><span className="font-medium">Lote:</span> {alerta.lote.numero ?? '—'}</p>
                  <p><span className="font-medium">Motivo:</span> {alerta.motivo}</p>
                  <p className="text-xs text-muted-foreground">
                    Vence: {textoPlazo(alerta)}
                    {alerta.unidades_en_riesgo !== null && ` · ${formatoNumero.format(alerta.unidades_en_riesgo)} unidades en riesgo`}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 bg-white"
                  disabled={enProceso}
                  onClick={() => marcarAtendida(alerta)}
                >
                  {enProceso ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                  Marcar como atendida
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
