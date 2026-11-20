import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { useKpis } from './api'
import {
  usePreferenciasDashboard,
  guardarPreferenciasDashboard,
  PREFERENCIAS_POR_DEFECTO,
  type PreferenciasDashboard,
  type Kpis,
} from './api'

const ETIQUETAS_KPI: Record<keyof Kpis, string> = {
  productos_activos: 'Productos activos',
  ventas_mes_actual: 'Ventas del mes',
  alertas_activas: 'Alertas activas',
  alertas_criticas: 'Alertas críticas',
  ordenes_pendientes: 'Órdenes pendientes',
}

const DESCRIPCIONES_KPI: Record<keyof Kpis, string> = {
  productos_activos: 'Cantidad de productos registrados y activos.',
  ventas_mes_actual: 'Cantidad vendida durante el mes actual.',
  alertas_activas: 'Alertas nuevas o pendientes de revisión.',
  alertas_criticas: 'Alertas activas clasificadas como críticas.',
  ordenes_pendientes: 'Órdenes de reabastecimiento pendientes.',
}

const ORDEN_INDICADORES: Array<keyof Kpis> = [
  'productos_activos',
  'ventas_mes_actual',
  'alertas_activas',
  'alertas_criticas',
  'ordenes_pendientes',
]

export default function DashboardPage() {
  const queryClient = useQueryClient()

  // Consultar indicadores
  const {
    data,
    isLoading: cargandoKpis,
    isError: errorKpis,
  } = useKpis()

  const {
    data: preferenciasGuardadas,
    isLoading: cargandoPreferencias,
    isError: errorPreferencias,
    refetch: recargarPreferencias,
  } = usePreferenciasDashboard()

  const [preferencias, setPreferencias] =
    useState<PreferenciasDashboard>(PREFERENCIAS_POR_DEFECTO)

  const [mostrarConfiguracion, setMostrarConfiguracion] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (preferenciasGuardadas) {
      setPreferencias(preferenciasGuardadas)
    }
  }, [preferenciasGuardadas])

  const guardarMutation = useMutation({
    mutationFn: guardarPreferenciasDashboard,

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['preferencias', 'dashboard'],
      })

      await recargarPreferencias()

      setMensaje('Preferencias guardadas correctamente.')
      setError('')
      setMostrarConfiguracion(false)
    },

    onError: () => {
      setError('No se pudieron guardar las preferencias.')
      setMensaje('')
    },
  })

  function cambiarIndicador(clave: keyof Kpis) {
    setPreferencias((actual) => ({
      ...actual,
      indicadores: {
        ...actual.indicadores,
        [clave]: !actual.indicadores[clave],
      },
    }))

    setMensaje('')
    setError('')
  }

  function guardar() {
    setMensaje('')
    setError('')
    guardarMutation.mutate(preferencias)
  }

  function restablecer() {
    setMensaje('')
    setError('')
    guardarMutation.mutate(PREFERENCIAS_POR_DEFECTO)
  }

  const indicadoresVisibles = data
    ? ORDEN_INDICADORES.filter(
        (clave) => preferencias.indicadores[clave],
      )
    : []

  if (cargandoKpis || cargandoPreferencias) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Cargando indicadores y preferencias...
        </p>
      </div>
    )
  }

  if (errorKpis || errorPreferencias || !data) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-destructive">
          No se pudo cargar el dashboard.
        </p>
        <button
          type="button"
          onClick={() => {
            void queryClient.invalidateQueries({
              queryKey: ['reportes', 'kpis'],
            })
            void recargarPreferencias()
          }}
          className="rounded-lg border px-4 py-2 text-sm"
        >
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Encabezado del dashboard */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Indicadores operativos del inventario.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setMostrarConfiguracion(!mostrarConfiguracion)
            setMensaje('')
            setError('')
          }}
          className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          {mostrarConfiguracion
            ? 'Cerrar configuración'
            : '⚙ Configurar dashboard'}
        </button>
      </div>

      {/* Mensaje de confirmación */}
      {mensaje && (
        <div
          role="status"
          className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-800"
        >
          {mensaje}
        </div>
      )}

      {/* Mensaje de error */}
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {/* Panel de configuración */}
      {mostrarConfiguracion && (
        <section className="space-y-4 rounded-xl border bg-card p-5">

          <div>
            <h2 className="text-lg font-semibold">
              Preferencias de visualización
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Selecciona los indicadores que deseas visualizar
              en tu dashboard.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">

            {ORDEN_INDICADORES.map((clave) => (
              <label
                key={clave}
                className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 hover:bg-muted/50"
              >
                <input
                  type="checkbox"
                  checked={preferencias.indicadores[clave]}
                  onChange={() => cambiarIndicador(clave)}
                  className="mt-1 h-4 w-4 accent-primary"
                />

                <span>
                  <span className="block text-sm font-medium">
                    {ETIQUETAS_KPI[clave]}
                  </span>

                  <span className="mt-1 block text-xs text-muted-foreground">
                    {DESCRIPCIONES_KPI[clave]}
                  </span>
                </span>
              </label>
            ))}

          </div>

          <div className="flex flex-wrap gap-3">

            <button
              type="button"
              onClick={guardar}
              disabled={guardarMutation.isPending}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {guardarMutation.isPending
                ? 'Guardando...'
                : 'Guardar preferencias'}
            </button>

            <button
              type="button"
              onClick={restablecer}
              disabled={guardarMutation.isPending}
              className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
            >
              Restablecer valores por defecto
            </button>

          </div>

        </section>
      )}

      {/* Indicadores del dashboard */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold">
            Indicadores generales
          </h2>
        </div>

        {indicadoresVisibles.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">

            {indicadoresVisibles.map((clave) => (
              <div
                key={clave}
                className="rounded-xl border bg-card p-4"
              >
                <p className="text-sm text-muted-foreground">
                  {ETIQUETAS_KPI[clave]}
                </p>

                <p className="mt-2 text-2xl font-semibold">
                  {data[clave]}
                </p>
              </div>
            ))}

          </div>
        ) : (
          <div className="rounded-xl border border-dashed p-8 text-center">
            <p className="font-medium">
              No hay indicadores seleccionados.
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              Configura tus preferencias para visualizar
              los indicadores del dashboard.
            </p>

            <button
              type="button"
              onClick={() => setMostrarConfiguracion(true)}
              className="mt-4 rounded-lg border px-4 py-2 text-sm"
            >
              Configurar indicadores
            </button>
          </div>
        )}
      </section>

    </div>
  )
}
