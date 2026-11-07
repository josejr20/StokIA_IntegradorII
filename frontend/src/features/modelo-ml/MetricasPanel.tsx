// HU-88 · FE-01 — Métricas de desempeño del modelo (MAE, RMSE) explicadas en lenguaje claro, con comparación entre versiones.
import { useState } from 'react'
import { ArrowDown, ArrowUp, Equal, TriangleAlert } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useComparacionVersiones, useMetricasModelo } from './api'
import type { CalidadModelo, ComparacionVersiones, MetricasVersion, Tendencia, VariacionMetrica } from './api'

const formatoNumero = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 2 })

const numero = (valor: number | null | undefined) => (valor === null || valor === undefined ? '—' : formatoNumero.format(valor))
const porcentaje = (valor: number | null | undefined) =>
  valor === null || valor === undefined ? '—' : `${(valor * 100).toLocaleString('es-PE', { maximumFractionDigits: 1 })} %`
const fechaHora = (iso: string | null) => (iso ? new Date(iso).toLocaleString('es-PE') : '—')

const ETIQUETA_CALIDAD: Record<CalidadModelo, string> = {
  buena: 'Buena',
  aceptable: 'Aceptable',
  requiere_revision: 'Requiere revisión',
  sin_datos: 'Sin datos',
}
const VARIANTE_CALIDAD: Record<CalidadModelo, 'bajo' | 'medio' | 'alto' | 'secondary'> = {
  buena: 'bajo',
  aceptable: 'medio',
  requiere_revision: 'alto',
  sin_datos: 'secondary',
}

const ETIQUETA_TENDENCIA: Record<Tendencia, string> = { mejora: 'Mejora', empeora: 'Empeora', igual: 'Sin cambio' }
const CLASE_TENDENCIA: Record<Tendencia, string> = {
  mejora: 'text-green-700',
  empeora: 'text-red-700',
  igual: 'text-muted-foreground',
}

/** Cambio de una métrica: flecha + diferencia + porcentaje. Para el error, bajar es mejorar. */
function Cambio({ variacion }: { variacion: VariacionMetrica | null }) {
  if (!variacion) return <span className="text-muted-foreground">—</span>
  const Icono = variacion.tendencia === 'mejora' ? ArrowDown : variacion.tendencia === 'empeora' ? ArrowUp : Equal
  const signo = variacion.diferencia > 0 ? '+' : ''
  return (
    <span className={`inline-flex items-center gap-1 ${CLASE_TENDENCIA[variacion.tendencia]}`}>
      <Icono className="size-3.5" aria-hidden />
      {signo}
      {numero(variacion.diferencia)}
      {variacion.porcentaje !== null && ` (${signo}${numero(variacion.porcentaje)} %)`}
    </span>
  )
}

function Tarjeta({ titulo, valor, ayuda }: { titulo: string; valor: string; ayuda: string }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{titulo}</p>
      <p className="mt-1 text-2xl font-semibold">{valor}</p>
      <p className="mt-1 text-xs text-muted-foreground">{ayuda}</p>
    </div>
  )
}

/** Barras del RMSE relativo por versión, con la línea del umbral aceptable (TC-04 / TC-05). */
function GraficoVersiones({ versiones, umbral }: { versiones: MetricasVersion[]; umbral: number }) {
  const ordenadas = [...versiones].reverse().filter((v) => v.rmse_relativo !== null) // de la más antigua a la más nueva
  if (ordenadas.length === 0) return null
  const maximo = Math.max(umbral * 1.3, ...ordenadas.map((v) => v.rmse_relativo ?? 0))
  const posicionUmbral = `${(umbral / maximo) * 100}%`
  return (
    <figure aria-label="RMSE relativo por versión">
      <figcaption className="mb-2 text-xs text-muted-foreground">
        RMSE relativo por versión (menos es mejor). La línea marca el umbral aceptable: {porcentaje(umbral)}.
      </figcaption>
      <div className="space-y-2">
        {ordenadas.map((v) => (
          <div key={v.id} className="flex items-center gap-3 text-xs">
            <span className="w-10 shrink-0 font-medium">{v.version}</span>
            <div className="relative h-5 flex-1 rounded bg-slate-100">
              <div
                className={`h-5 rounded ${v.calidad === 'requiere_revision' ? 'bg-red-500' : v.calidad === 'aceptable' ? 'bg-amber-500' : 'bg-green-500'}`}
                style={{ width: `${((v.rmse_relativo ?? 0) / maximo) * 100}%` }}
              />
              <div className="absolute inset-y-0 w-0.5 bg-slate-700" style={{ left: posicionUmbral }} title="Umbral aceptable" />
            </div>
            <span className="w-14 shrink-0 text-right tabular-nums">{porcentaje(v.rmse_relativo)}</span>
          </div>
        ))}
      </div>
    </figure>
  )
}

/** TC-05: el administrador elige dos versiones cualesquiera y ve cuál rinde mejor. */
function ComparadorVersiones({ versiones }: { versiones: MetricasVersion[] }) {
  const [base, setBase] = useState<number | null>(null)
  const [nueva, setNueva] = useState<number | null>(null)
  const comparacion = useComparacionVersiones(base, nueva)
  const resultado: ComparacionVersiones | undefined = comparacion.data

  if (versiones.length < 2) return null
  const opciones = (
    <>
      <option value="">Elegir…</option>
      {versiones.map((v) => (
        <option key={v.id} value={v.id}>
          {v.version}
        </option>
      ))}
    </>
  )
  return (
    <div className="rounded-lg border bg-white p-4">
      <h3 className="text-sm font-semibold">Comparar dos versiones</h3>
      <div className="mt-2 flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Versión de referencia</span>
          <select className="rounded-md border px-2 py-1" value={base ?? ''} onChange={(e) => setBase(e.target.value ? Number(e.target.value) : null)}>
            {opciones}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Versión a comparar</span>
          <select className="rounded-md border px-2 py-1" value={nueva ?? ''} onChange={(e) => setNueva(e.target.value ? Number(e.target.value) : null)}>
            {opciones}
          </select>
        </label>
      </div>
      {base !== null && base === nueva && <p className="mt-2 text-xs text-amber-700">Elige dos versiones distintas.</p>}
      {comparacion.isError && <p className="mt-2 text-xs text-red-700">No se pudo comparar las versiones.</p>}
      {resultado && (
        <div role="status" className="mt-3 text-sm">
          <p className="font-medium">
            {resultado.nueva.version} frente a {resultado.base.version}:{' '}
            {resultado.veredicto === 'sin_datos' ? 'sin datos para comparar' : ETIQUETA_TENDENCIA[resultado.veredicto].toLowerCase()}
          </p>
          <ul className="mt-1 space-y-0.5 text-xs">
            <li>MAE: <Cambio variacion={resultado.mae} /></li>
            <li>RMSE: <Cambio variacion={resultado.rmse} /></li>
            <li>RMSE relativo: <Cambio variacion={resultado.rmse_relativo} /></li>
          </ul>
        </div>
      )}
    </div>
  )
}

/** HU-88: panel completo de métricas. Se alimenta de GET /api/ml/metricas. */
export default function MetricasPanel() {
  const metricas = useMetricasModelo()
  const [versionElegida, setVersionElegida] = useState<number | null>(null)

  if (metricas.isLoading) return <p className="text-sm text-muted-foreground">Cargando métricas…</p>
  if (metricas.isError || !metricas.data) {
    return <p className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm">No se pudieron cargar las métricas del modelo.</p>
  }

  const datos = metricas.data
  if (!datos.hay_modelo_entrenado) {
    return (
      <section className="rounded-xl border bg-white p-5">
        <h2 className="font-semibold">Métricas de desempeño</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Todavía no hay un modelo entrenado, así que no hay métricas que mostrar. Entrena el modelo para calcular el MAE y el RMSE.
        </p>
      </section>
    )
  }

  // Se muestra la versión elegida; si no hay, la activa; si tampoco, la más reciente.
  const foco =
    datos.versiones.find((v) => v.id === versionElegida) ?? datos.versiones.find((v) => v.id === datos.modelo_activo_id) ?? datos.versiones[0]

  return (
    <section className="space-y-4" aria-label="Métricas de desempeño del modelo">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Métricas de desempeño</h2>
          <p className="text-xs text-muted-foreground">
            Miden cuánto se equivoca el modelo al predecir la demanda semanal de cada producto (menos es mejor).
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-xs text-muted-foreground">Versión</span>
          <select
            aria-label="Versión a mostrar"
            className="rounded-md border px-2 py-1"
            value={foco.id}
            onChange={(e) => setVersionElegida(Number(e.target.value))}
          >
            {datos.versiones.map((v) => (
              <option key={v.id} value={v.id}>
                {v.version}
                {v.id === datos.modelo_activo_id ? ' (activa)' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>

      {foco.requiere_revision && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 p-4 text-sm">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-red-600" aria-hidden />
          <div>
            <p className="font-semibold">La versión {foco.version} requiere revisión</p>
            <p className="mt-1">
              Su error ({porcentaje(foco.ultima_evaluacion && foco.id === datos.modelo_activo_id ? foco.ultima_evaluacion.rmse_relativo : foco.rmse_relativo)})
              supera el umbral aceptable de {porcentaje(foco.umbral_rmse_relativo)}. Conviene reentrenar el modelo o revisar los datos de ventas.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <Tarjeta titulo="MAE · error medio" valor={`${numero(foco.mae)} u.`} ayuda="Unidades que, en promedio, se desvía la predicción semanal de un producto." />
        <Tarjeta titulo="RMSE · error cuadrático" valor={`${numero(foco.rmse)} u.`} ayuda="Como el MAE, pero castiga más los errores grandes." />
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Calidad</p>
          <p className="mt-1 flex items-center gap-2 text-2xl font-semibold">
            {porcentaje(foco.rmse_relativo)}
            <Badge variant={VARIANTE_CALIDAD[foco.calidad]}>{ETIQUETA_CALIDAD[foco.calidad]}</Badge>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">RMSE relativo frente a la demanda promedio. Umbral aceptable: {porcentaje(foco.umbral_rmse_relativo)}.</p>
        </div>
      </div>

      {foco.interpretacion && <p className="rounded-lg bg-slate-50 p-3 text-sm">{foco.interpretacion}</p>}

      <div className="rounded-lg border bg-white p-4">
        <GraficoVersiones versiones={datos.versiones} umbral={datos.umbral_rmse_relativo} />
      </div>

      <div className="rounded-xl border bg-white">
        <div className="border-b px-5 py-3">
          <h3 className="font-semibold">Comparación entre versiones</h3>
          <p className="text-xs text-muted-foreground">Cada versión se compara con la anterior. Una flecha hacia abajo en el error es una mejora.</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Versión</TableHead>
              <TableHead>MAE</TableHead>
              <TableHead>RMSE</TableHead>
              <TableHead>RMSE relativo</TableHead>
              <TableHead>Calidad</TableHead>
              <TableHead>Frente a la anterior</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {datos.versiones.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-medium">
                  {v.version}
                  {v.id === datos.mejor_version_id && <Badge variant="bajo" className="ml-2">Mejor</Badge>}
                  {v.id === datos.modelo_activo_id && <Badge variant="secondary" className="ml-2">Activa</Badge>}
                </TableCell>
                <TableCell>{numero(v.mae)}</TableCell>
                <TableCell>{numero(v.rmse)}</TableCell>
                <TableCell>{porcentaje(v.rmse_relativo)}</TableCell>
                <TableCell>
                  <Badge variant={VARIANTE_CALIDAD[v.calidad]}>{v.requiere_revision && v.calidad !== 'requiere_revision' ? 'Requiere revisión' : ETIQUETA_CALIDAD[v.calidad]}</Badge>
                </TableCell>
                <TableCell>
                  {v.vs_anterior ? (
                    <span className="inline-flex flex-col">
                      <span className={`font-medium ${v.vs_anterior.veredicto === 'sin_datos' ? '' : CLASE_TENDENCIA[v.vs_anterior.veredicto]}`}>
                        {v.vs_anterior.veredicto === 'sin_datos' ? '—' : ETIQUETA_TENDENCIA[v.vs_anterior.veredicto]}
                      </span>
                      <span className="text-xs">
                        RMSE rel.: <Cambio variacion={v.vs_anterior.rmse_relativo} />
                      </span>
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Primera versión</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ComparadorVersiones versiones={datos.versiones} />

      <div className="rounded-xl border bg-white">
        <div className="border-b px-5 py-3">
          <h3 className="font-semibold">Historial de métricas · {foco.version}</h3>
          <p className="text-xs text-muted-foreground">Medición al entrenar y cada evaluación posterior con ventas recientes.</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Origen</TableHead>
              <TableHead>MAE</TableHead>
              <TableHead>RMSE</TableHead>
              <TableHead>RMSE relativo</TableHead>
              <TableHead>Resultado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>{fechaHora(foco.fecha_entrenamiento)}</TableCell>
              <TableCell>Entrenamiento</TableCell>
              <TableCell>{numero(foco.mae)}</TableCell>
              <TableCell>{numero(foco.rmse)}</TableCell>
              <TableCell>{porcentaje(foco.rmse_relativo)}</TableCell>
              <TableCell>{foco.cumple_umbral ? 'Dentro del umbral' : 'Supera el umbral'}</TableCell>
            </TableRow>
            {[...foco.historial_evaluaciones].reverse().map((e) => (
              <TableRow key={e.fecha}>
                <TableCell>{fechaHora(e.fecha)}</TableCell>
                <TableCell>Evaluación</TableCell>
                <TableCell>{numero(e.mae)}</TableCell>
                <TableCell>{numero(e.rmse)}</TableCell>
                <TableCell>{porcentaje(e.rmse_relativo)}</TableCell>
                <TableCell>{e.aprobado ? 'Dentro del umbral' : 'Supera el umbral'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
