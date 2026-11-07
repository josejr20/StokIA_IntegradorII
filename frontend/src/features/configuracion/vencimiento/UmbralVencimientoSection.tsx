import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { ApiError } from '@/lib/api'
import {
  useConfiguracionVencimiento,
  useEvaluarVencimiento,
  useGuardarUmbralVencimiento,
  useRestablecerUmbralCategoria,
  useRiesgoVencimiento,
  type OrigenUmbral,
} from './api'
import { errorUmbralDias, textoDias } from './validacion'

const ETIQUETA_ORIGEN: Record<OrigenUmbral, string> = {
  categoria: 'Propio de la categoría',
  global: 'General',
  predeterminado: 'Predeterminado',
}

const CLASE_SEVERIDAD: Record<string, string> = {
  critica: 'text-red-700',
  alta: 'text-red-600',
  media: 'text-amber-600',
  baja: 'text-yellow-700',
}

function mensajeError(error: unknown) {
  return error instanceof ApiError || error instanceof Error ? error.message : 'No se pudo completar la operación.'
}

/**
 * HU-118 (US-23): el administrador define cuántos días antes del vencimiento se activa la alerta,
 * de forma general y/o por categoría de producto. Cada cambio se confirma con un mensaje (TC-07).
 */
export default function UmbralVencimientoSection() {
  const { data: config, isLoading, isError, error, refetch } = useConfiguracionVencimiento()
  const riesgo = useRiesgoVencimiento()
  const guardar = useGuardarUmbralVencimiento()
  const restablecer = useRestablecerUmbralCategoria()
  const evaluar = useEvaluarVencimiento()

  const [diasGeneral, setDiasGeneral] = useState<string | null>(null)
  const [errorGeneral, setErrorGeneral] = useState('')
  const [edicion, setEdicion] = useState<Record<number, string>>({})
  const [errores, setErrores] = useState<Record<number, string>>({})
  const [confirmacion, setConfirmacion] = useState('')

  const ocupado = guardar.isPending || restablecer.isPending || evaluar.isPending

  /** Muestra la confirmación (TC-07) como mensaje fijo en pantalla y como aviso emergente. */
  function confirmar(mensaje: string, aviso?: string | null) {
    const texto = aviso ? `${mensaje} ${aviso}` : mensaje
    setConfirmacion(texto)
    toast.success(mensaje)
    if (aviso) toast.warning(aviso)
  }

  async function guardarGeneral(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const texto = diasGeneral ?? String(config?.general.dias ?? '')
    const problema = errorUmbralDias(texto)
    setErrorGeneral(problema ?? '')
    setConfirmacion('')
    if (problema) return // TC-02: no se envía un valor inválido
    try {
      const r = await guardar.mutateAsync({ categoriaId: null, dias: Number(texto) })
      setDiasGeneral(null)
      confirmar(r.message, r.aviso)
    } catch (e) {
      setErrorGeneral(mensajeError(e))
    }
  }

  async function guardarCategoria(categoriaId: number, valorActual: number) {
    const texto = edicion[categoriaId] ?? String(valorActual)
    const problema = errorUmbralDias(texto)
    setErrores((previo) => ({ ...previo, [categoriaId]: problema ?? '' }))
    setConfirmacion('')
    if (problema) return
    try {
      const r = await guardar.mutateAsync({ categoriaId, dias: Number(texto) })
      setEdicion(({ [categoriaId]: _omitido, ...resto }) => resto)
      confirmar(r.message, r.aviso)
    } catch (e) {
      setErrores((previo) => ({ ...previo, [categoriaId]: mensajeError(e) }))
    }
  }

  async function usarGeneral(categoriaId: number, nombre: string) {
    if (!window.confirm(`¿La categoría «${nombre}» debe volver a usar el umbral general?`)) return
    setConfirmacion('')
    try {
      const r = await restablecer.mutateAsync(categoriaId)
      setEdicion(({ [categoriaId]: _omitido, ...resto }) => resto)
      setErrores((previo) => ({ ...previo, [categoriaId]: '' }))
      confirmar(r.message, r.aviso)
    } catch (e) {
      setErrores((previo) => ({ ...previo, [categoriaId]: mensajeError(e) }))
    }
  }

  async function recalcular() {
    setConfirmacion('')
    try {
      const r = await evaluar.mutateAsync()
      confirmar(`${r.message} ${r.data.creadas} alertas creadas, ${r.data.actualizadas} actualizadas y ${r.data.resueltas} resueltas.`)
    } catch (e) {
      toast.error(mensajeError(e))
    }
  }

  if (isLoading) return <p role="status">Cargando configuración de vencimiento...</p>
  if (isError || !config) {
    return (
      <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">
        No se pudo cargar la configuración: {mensajeError(error)}
        <button type="button" className="ml-3 underline" onClick={() => void refetch()}>Reintentar</button>
      </div>
    )
  }

  const valorGeneral = diasGeneral ?? String(config.general.dias)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Umbral de días para la alerta de vencimiento</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          HU-118: defina cuántos días antes del vencimiento se considera que un lote está en riesgo. Puede
          fijar un valor general y valores distintos por categoría de producto (por ejemplo, lácteos
          necesitan más sensibilidad que abarrotes).
        </p>
      </div>

      {confirmacion && (
        <p role="status" data-testid="confirmacion-umbral" className="rounded-lg border border-green-300 bg-green-50 p-3 text-green-800">
          {confirmacion}
        </p>
      )}

      <form onSubmit={(event) => void guardarGeneral(event)} noValidate className="space-y-3 rounded-xl border bg-card p-5">
        <h3 className="text-lg font-semibold">Umbral general</h3>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-2 text-sm font-medium">
            Días de anticipación
            <input
              inputMode="numeric"
              autoComplete="off"
              aria-invalid={Boolean(errorGeneral)}
              aria-describedby={errorGeneral ? 'error-umbral-general' : undefined}
              className="w-40 rounded-md border bg-background p-3"
              value={valorGeneral}
              onChange={(event) => { setDiasGeneral(event.target.value); setErrorGeneral('') }}
            />
          </label>
          <button disabled={ocupado} type="submit" className="rounded-md bg-green-800 px-4 py-2 font-medium text-white disabled:opacity-50">
            {guardar.isPending ? 'Guardando...' : 'Guardar umbral general'}
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          Actual: <strong>{textoDias(config.general.dias)}</strong>
          {config.general.configurado ? '' : ` (valor predeterminado; aún no se configuró)`}. Se aplica a las categorías sin umbral propio.
        </p>
        {errorGeneral && <p id="error-umbral-general" role="alert" className="text-sm text-red-700">{errorGeneral}</p>}
      </form>

      <section className="space-y-3 rounded-xl border bg-card p-5">
        <h3 className="text-lg font-semibold">Umbral por categoría</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="p-3">Categoría</th><th className="p-3">Umbral vigente</th><th className="p-3">Origen</th><th className="p-3">Nuevo valor (días)</th><th className="p-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {config.categorias.map((categoria) => (
                <tr className="border-b align-top" key={categoria.categoria_id}>
                  <td className="p-3 font-medium">{categoria.nombre}</td>
                  <td className="p-3">{textoDias(categoria.dias)}</td>
                  <td className="p-3">{ETIQUETA_ORIGEN[categoria.origen]}</td>
                  <td className="p-3">
                    <input
                      aria-label={`Días de anticipación para ${categoria.nombre}`}
                      aria-invalid={Boolean(errores[categoria.categoria_id])}
                      inputMode="numeric"
                      autoComplete="off"
                      className="w-28 rounded-md border bg-background p-2"
                      value={edicion[categoria.categoria_id] ?? String(categoria.dias)}
                      onChange={(event) => {
                        setEdicion((previo) => ({ ...previo, [categoria.categoria_id]: event.target.value }))
                        setErrores((previo) => ({ ...previo, [categoria.categoria_id]: '' }))
                      }}
                    />
                    {errores[categoria.categoria_id] && <p role="alert" className="mt-1 max-w-xs text-xs text-red-700">{errores[categoria.categoria_id]}</p>}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" disabled={ocupado} className="rounded-md bg-green-800 px-3 py-2 text-white disabled:opacity-50" onClick={() => void guardarCategoria(categoria.categoria_id, categoria.dias)}>Guardar</button>
                      <button type="button" disabled={ocupado || !categoria.configurado} className="rounded-md border px-3 py-2 disabled:opacity-50" onClick={() => void usarGeneral(categoria.categoria_id, categoria.nombre)}>Usar general</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {config.categorias.length === 0 && <p className="p-4 text-sm">No hay categorías registradas.</p>}
        </div>
      </section>

      <section className="space-y-3 rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Lotes en riesgo con el umbral vigente</h3>
            <p className="text-sm text-muted-foreground">
              {riesgo.data
                ? `${riesgo.data.total_en_riesgo} de ${riesgo.data.lotes_evaluados} lotes con stock están vencidos o por vencer.`
                : 'Calculando...'}
            </p>
          </div>
          <button type="button" disabled={ocupado} className="rounded-md border px-4 py-2 disabled:opacity-50" onClick={() => void recalcular()}>
            Recalcular alertas
          </button>
        </div>
        {riesgo.isError && <p role="alert" className="text-sm text-red-700">No se pudo calcular el riesgo: {mensajeError(riesgo.error)}</p>}
        {riesgo.data && riesgo.data.data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead><tr className="border-b text-muted-foreground"><th className="p-3">Producto</th><th className="p-3">Lote</th><th className="p-3">Stock</th><th className="p-3">Vence</th><th className="p-3">Días</th><th className="p-3">Umbral</th><th className="p-3">Estado</th></tr></thead>
              <tbody>
                {riesgo.data.data.map((lote) => (
                  <tr className="border-b" key={lote.lote_id}>
                    <td className="p-3"><strong>{lote.producto_nombre}</strong><span className="block text-xs text-muted-foreground">{lote.producto_codigo}</span></td>
                    <td className="p-3">{lote.numero_lote}</td>
                    <td className="p-3">{lote.cantidad_actual}</td>
                    <td className="p-3">{lote.fecha_vencimiento}</td>
                    <td className="p-3">{lote.dias_restantes}</td>
                    <td className="p-3">{textoDias(lote.umbral_dias)} <span className="block text-xs text-muted-foreground">{ETIQUETA_ORIGEN[lote.origen_umbral]}</span></td>
                    <td className={`p-3 font-medium ${CLASE_SEVERIDAD[lote.severidad] ?? ''}`}>{lote.estado === 'vencido' ? 'Vencido' : `En riesgo (${lote.severidad})`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {riesgo.data && riesgo.data.data.length === 0 && <p className="text-sm">Ningún lote está dentro del umbral configurado.</p>}
      </section>
    </div>
  )
}
