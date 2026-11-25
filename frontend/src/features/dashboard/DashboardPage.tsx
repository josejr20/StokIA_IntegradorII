
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { useAuth } from '@/auth/AuthContext'
import { api } from '@/lib/api'
import { useKpis, type Kpis } from './api'

const INDICADORES: { clave: keyof Kpis; etiqueta: string }[] = [
  { clave: 'productos_activos', etiqueta: 'Productos activos' },
  { clave: 'ventas_mes_actual', etiqueta: 'Ventas del mes' },
  { clave: 'alertas_activas', etiqueta: 'Alertas activas' },
  { clave: 'alertas_criticas', etiqueta: 'Alertas críticas' },
  { clave: 'ordenes_pendientes', etiqueta: 'Órdenes pendientes' },
]

const INDICADORES_PREDETERMINADOS = INDICADORES.map(
  (indicador) => indicador.clave
)

const CLAVE_PREFERENCIA = 'dashboard_kpis'

interface PreferenciaDashboard {
  id: number
  usuario_id: number
  clave: string
  valor: {
    indicadores: string[]
  }
  fecha_actualizacion: string
}

export default function DashboardPage() {
  const { usuario } = useAuth()

  const { data, isLoading, isError } = useKpis()

  const {
    data: preferencias,
    isLoading: cargandoPreferencias,
    isError: errorPreferencias,
    refetch,
  } = useQuery({
    queryKey: ['preferencias-dashboard', usuario?.id],
    enabled: Boolean(usuario?.id),
    queryFn: async () => {
      const respuesta = await api.get<{
        data: PreferenciaDashboard[]
      }>('/preferencias')

      return respuesta.data.find(
        (preferencia) => preferencia.clave === CLAVE_PREFERENCIA
      )
    },
  })

  const [indicadoresSeleccionados, setIndicadoresSeleccionados] =
    useState<(keyof Kpis)[]>(INDICADORES_PREDETERMINADOS)

  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (preferencias?.valor?.indicadores) {
      const indicadoresValidos = preferencias.valor.indicadores.filter(
        (clave): clave is keyof Kpis =>
          INDICADORES.some((indicador) => indicador.clave === clave)
      )

      setIndicadoresSeleccionados(
        indicadoresValidos.length > 0
          ? indicadoresValidos
          : INDICADORES_PREDETERMINADOS
      )
    } else if (!cargandoPreferencias) {
      setIndicadoresSeleccionados(INDICADORES_PREDETERMINADOS)
    }
  }, [preferencias, cargandoPreferencias])

  function cambiarIndicador(clave: keyof Kpis) {
    setIndicadoresSeleccionados((actuales) =>
      actuales.includes(clave)
        ? actuales.filter((indicador) => indicador !== clave)
        : [...actuales, clave]
    )

    setMensaje('')
    setError('')
  }

  async function guardarPreferencias() {
    if (indicadoresSeleccionados.length === 0) {
      setError('Debe seleccionar al menos un indicador.')
      return
    }

    setGuardando(true)
    setMensaje('')
    setError('')

    try {
      await api.post('/preferencias', {
        clave: CLAVE_PREFERENCIA,
        valor: {
          indicadores: indicadoresSeleccionados,
        },
      })

      await refetch()

      setMensaje('Preferencias guardadas correctamente.')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudieron guardar las preferencias.'
      )
    } finally {
      setGuardando(false)
    }
  }

  async function restablecerPreferencias() {
    setGuardando(true)
    setMensaje('')
    setError('')

    try {
      if (preferencias) {
        await api.del(`/preferencias/${CLAVE_PREFERENCIA}`)
      }

      setIndicadoresSeleccionados(INDICADORES_PREDETERMINADOS)

      await refetch()

      setMensaje('Se restablecieron los indicadores predeterminados.')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo restablecer la configuración.'
      )
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="space-y-6">

      {/* Encabezado del dashboard */}
      <div>
        <h1 className="text-2xl font-semibold">
          Dashboard
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Indicadores operativos del inventario.
        </p>
      </div>

      {/* Configuración de preferencias */}
      <section className="space-y-4 rounded-xl border bg-white p-5">

        <div>
          <h2 className="text-lg font-semibold">
            Preferencias de visualización
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Seleccione los indicadores que desea visualizar
            en su dashboard.
          </p>
        </div>

        {cargandoPreferencias ? (
          <p className="text-sm text-muted-foreground">
            Cargando preferencias...
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">

            {INDICADORES.map((indicador) => (
              <label
                key={indicador.clave}
                className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={indicadoresSeleccionados.includes(
                    indicador.clave
                  )}
                  onChange={() => cambiarIndicador(indicador.clave)}
                  disabled={guardando}
                  className="h-4 w-4 accent-green-700"
                />

                <span className="text-sm font-medium">
                  {indicador.etiqueta}
                </span>
              </label>
            ))}

          </div>
        )}

        {/* Acciones de configuración */}
        <div className="flex flex-wrap gap-3">

          <button
            type="button"
            onClick={() => void guardarPreferencias()}
            disabled={
              guardando ||
              cargandoPreferencias ||
              indicadoresSeleccionados.length === 0
            }
            className="rounded-md bg-green-800 px-4 py-2 text-sm font-medium text-white hover:bg-green-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {guardando ? 'Procesando...' : 'Guardar preferencias'}
          </button>

          <button
            type="button"
            onClick={() => void restablecerPreferencias()}
            disabled={guardando || cargandoPreferencias}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Restablecer valores por defecto
          </button>

        </div>

        {/* Confirmación de operaciones */}
        {mensaje && (
          <p role="status" className="text-sm text-green-700">
            ✓ {mensaje}
          </p>
        )}

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        {errorPreferencias && (
          <p role="alert" className="text-sm text-red-600">
            No se pudieron recuperar las preferencias guardadas.
          </p>
        )}

      </section>

      {/* Indicadores operativos */}
      <section className="space-y-4">

        <h2 className="text-lg font-semibold">
          Indicadores operativos
        </h2>

        {isLoading && (
          <p className="text-sm text-muted-foreground">
            Cargando indicadores...
          </p>
        )}

        {isError && (
          <p className="text-sm text-red-600">
            No se pudieron cargar los indicadores.
          </p>
        )}

        {data && !cargandoPreferencias && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">

            {INDICADORES.filter((indicador) =>
              indicadoresSeleccionados.includes(indicador.clave)
            ).map((indicador) => (
              <div
                key={indicador.clave}
                className="rounded-xl border bg-white p-4"
              >
                <p className="text-sm text-muted-foreground">
                  {indicador.etiqueta}
                </p>

                <p className="mt-2 text-2xl font-semibold">
                  {data[indicador.clave]}
                </p>
              </div>
            ))}

          </div>
        )}

        {!cargandoPreferencias &&
          !isLoading &&
          indicadoresSeleccionados.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No hay indicadores seleccionados.
            </p>
          )}

      </section>

    </div>
  )
}