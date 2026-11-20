import StockDashboard from './StockDashboard'
import PrediccionesDashboard from './PrediccionesDashboard'

import { useState } from 'react'
import { useKpis, useResumenInicio } from './api'
import { useAuth } from '@/auth/AuthContext'

const ETIQUETAS_KPI: Record<string, string> = {
  productos_activos: 'Productos activos',
  ventas_mes_actual: 'Ventas del mes',
  alertas_activas: 'Alertas activas',
  alertas_criticas: 'Alertas crÃ­ticas',
  ordenes_pendientes: 'Ã“rdenes pendientes',
  stock_bajo: 'Stock bajo',
  productos_vencidos: 'Productos vencidos',
  productos_proximos_vencer: 'PrÃ³ximos a vencer',
}

const PRIORIDAD: Record<string, number> = {
  critica: 4,
  alta: 3,
  media: 2,
  baja: 1,
}

export default function DashboardPage() {
  const { tienePermiso } = useAuth()

  const puedeVerKpis = tienePermiso('ver_kpis')
  const puedeVerAlertas = tienePermiso('ver_alertas')
  const { data, isLoading, isError } = useKpis(puedeVerKpis)
  const { data: resumen, isLoading: cargandoAlertas } = useResumenInicio(puedeVerAlertas)
  const [filtro, setFiltro] = useState('todas')

  const alertas = (resumen?.alertas_recientes ?? [])
    .filter((alerta) =>
      ['nueva', 'activa'].includes(alerta.estado?.toLowerCase())
    )
    .filter((alerta) =>
      filtro === 'todas' ||
      alerta.severidad.toLowerCase() === filtro
    )
    .sort(
      (a, b) =>
        (PRIORIDAD[b.severidad.toLowerCase()] ?? 0) -
        (PRIORIDAD[a.severidad.toLowerCase()] ?? 0)
    )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Indicadores operativos del inventario.
        </p>
      </div>

      {isLoading && <p>Cargando indicadores...</p>}
      {isError && <p className="text-red-600">Error al cargar indicadores.</p>}

      {puedeVerKpis && data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Object.entries(data).map(([clave, valor]) => (
            <div key={clave} className="rounded-xl border bg-white p-4">
              <p className="text-sm text-muted-foreground">
                {ETIQUETAS_KPI[clave] ?? clave.replaceAll('_', ' ')}
              </p>
              <p className="mt-2 text-2xl font-semibold">{valor}</p>
            </div>
          ))}
        </div>
      )}

      {puedeVerAlertas && (
        <section className="rounded-xl border bg-white p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Alertas de inventario</h2>

            <select
              className="rounded-lg border px-3 py-2"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              aria-label="Filtrar alertas por prioridad"
            >
              <option value="todas">Todas las prioridades</option>
              <option value="critica">CrÃ­tica</option>
              <option value="alta">Alta</option>
              <option value="media">Media</option>
              <option value="baja">Baja</option>
            </select>
          </div>

          {cargandoAlertas ? (
            <p>Cargando alertas...</p>
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
                  <div>
                    <div>
                      <p className="font-semibold">
                        {alerta.datos_origen?.nombre ?? 'Producto sin nombre'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {alerta.mensaje}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
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
        </section>
      )}
      {puedeVerKpis && <PrediccionesDashboard />}
      {puedeVerKpis && <StockDashboard />}
    </div>
  )
}



