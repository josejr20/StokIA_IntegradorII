import { useAuth } from '@/auth/AuthContext'

import { useAlertasBajoStock, useKpis } from './api'

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
  const { data, isLoading, isError } = useKpis()
  const { tienePermiso } = useAuth()
  const puedeVerAlertas = tienePermiso('ver_alertas')
  const { data: alertasBajoStock, isLoading: cargandoAlertas, isError: errorAlertas } =
    useAlertasBajoStock(puedeVerAlertas)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Indicadores operativos del inventario.</p>
      </div>
      {isLoading && <p className="text-muted-foreground">Cargando indicadores...</p>}
      {isError && <p className="text-destructive">No se pudieron cargar los indicadores.</p>}
      {data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Object.entries(data).map(([clave, valor]) => (
            <div key={clave} className="rounded-xl border bg-white p-4">
              <p className="text-sm text-muted-foreground">{ETIQUETAS_KPI[clave] ?? clave.replaceAll('_', ' ')}</p>
              <p className="mt-2 text-2xl font-semibold">{valor}</p>
            </div>
          ))}
        </div>
      )}
      {puedeVerAlertas && (
        <section className="rounded-xl border bg-white p-4">
          <h2 className="font-semibold">Alertas de bajo stock</h2>
          {cargandoAlertas && <p className="mt-2 text-sm text-muted-foreground">Cargando alertas...</p>}
          {errorAlertas && <p className="mt-2 text-sm text-destructive">No se pudieron cargar las alertas de bajo stock.</p>}
          {alertasBajoStock && alertasBajoStock.length === 0 && (
            <p className="mt-2 text-sm text-muted-foreground">No hay productos por debajo del stock mínimo.</p>
          )}
          {alertasBajoStock && alertasBajoStock.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="p-2">Producto</th>
                    <th className="p-2">Stock</th>
                    <th className="p-2">Mínimo</th>
                    <th className="p-2">Faltan</th>
                    <th className="p-2">Severidad</th>
                  </tr>
                </thead>
                <tbody>
                  {alertasBajoStock.map((alerta) => (
                    <tr key={alerta.id} className="border-b last:border-0">
                      <td className="p-2">{alerta.datos_origen?.nombre ?? alerta.mensaje}</td>
                      <td className="p-2">{alerta.datos_origen?.stock_disponible ?? '-'}</td>
                      <td className="p-2">{alerta.datos_origen?.stock_minimo ?? '-'}</td>
                      <td className="p-2">{alerta.datos_origen?.faltante ?? '-'}</td>
                      <td className="p-2 capitalize">{alerta.severidad}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  )
}