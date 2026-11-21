
import { useState } from 'react'
import { useKpis, useAlertasPaginadas } from './api'
import { useAuth } from '@/auth/AuthContext'
import StockDashboard from './StockDashboard'
import PrediccionesDashboard from './PrediccionesDashboard'

const ETIQUETAS_KPI: Record<string, string> = {
  productos_activos: 'Productos activos',
  ventas_mes_actual: 'Ventas del mes',
  alertas_activas: 'Alertas activas',
  alertas_criticas: 'Alertas críticas',
  ordenes_pendientes: 'Órdenes pendientes',
  stock_bajo: 'Stock bajo',
  productos_vencidos: 'Productos vencidos',
  productos_proximos_vencer: 'Próximos a vencer',
}

export default function DashboardPage() {
  const { tienePermiso } = useAuth()

  const puedeVerKpis = tienePermiso('ver_kpis')
  const puedeVerAlertas = tienePermiso('ver_alertas')

  const {
    data,
    isLoading,
    isError,
  } = useKpis(puedeVerKpis)

  const [filtro, setFiltro] = useState('todas')
  const [pagina, setPagina] = useState(1)

  const {
    data: respuestaAlertas,
    isLoading: cargandoAlertas,
    isFetching: actualizandoAlertas,
    isError: errorAlertas,
  } = useAlertasPaginadas(pagina, filtro, puedeVerAlertas)

  const alertas = respuestaAlertas?.data ?? []
  const paginacion = respuestaAlertas?.paginacion

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Indicadores operativos del inventario.
        </p>
      </div>

      {puedeVerKpis && isLoading && (
        <p>Cargando indicadores...</p>
      )}

      {puedeVerKpis && isError && (
        <p className="text-red-600">
          Error al cargar indicadores.
        </p>
      )}

      {puedeVerKpis && data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Object.entries(data).map(([clave, valor]) => (
            <div
              key={clave}
              className="rounded-xl border bg-white p-4"
            >
              <p className="text-sm text-muted-foreground">
                {ETIQUETAS_KPI[clave] ?? clave.replaceAll('_', ' ')}
              </p>

              <p className="mt-2 text-2xl font-semibold">
                {valor}
              </p>
            </div>
          ))}
        </div>
      )}

      {puedeVerAlertas && (
        <section className="rounded-xl border bg-white p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">
                Alertas de inventario
              </h2>
              <p className="text-sm text-muted-foreground">
                Alertas pendientes ordenadas por prioridad.
              </p>
            </div>

            <select
              className="rounded-lg border px-3 py-2"
              value={filtro}
              onChange={(e) => {
                setFiltro(e.target.value)
                setPagina(1)
              }}
              aria-label="Filtrar alertas por prioridad"
            >
              <option value="todas">
                Todas las prioridades
              </option>
              <option value="critica">Crítica</option>
              <option value="alta">Alta</option>
              <option value="media">Media</option>
              <option value="baja">Baja</option>
            </select>
          </div>

          {cargandoAlertas ? (
            <p>Cargando alertas...</p>
          ) : errorAlertas ? (
            <p className="text-sm text-red-600">
              No se pudieron cargar las alertas.
            </p>
          ) : alertas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay alertas activas para este filtro.
            </p>
          ) : (
            <div className="space-y-3">
              {alertas.map((alerta) => (
                <div
                  key={alerta.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {alerta.datos_origen?.nombre ??
                        'Producto sin nombre'}
                    </p>

                    <p className="text-sm text-muted-foreground">
                      {alerta.mensaje}
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      {alerta.tipo}
                    </p>
                  </div>

                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold">
                    {alerta.severidad.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          )}

          {paginacion && paginacion.totalPaginas > 0 && (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <p className="text-sm text-muted-foreground">
                Página {paginacion.pagina} de{' '}
                {paginacion.totalPaginas}
                {' · '}
                {paginacion.total} alertas
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-lg border px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={pagina <= 1 || actualizandoAlertas}
                  onClick={() =>
                    setPagina((p) => Math.max(1, p - 1))
                  }
                >
                  Anterior
                </button>

                <button
                  type="button"
                  className="rounded-lg border px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={
                    pagina >= paginacion.totalPaginas ||
                    actualizandoAlertas
                  }
                  onClick={() =>
                    setPagina((p) => p + 1)
                  }
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {puedeVerKpis && <PrediccionesDashboard />}
      {puedeVerKpis && <StockDashboard />}
    </div>
  )
}
