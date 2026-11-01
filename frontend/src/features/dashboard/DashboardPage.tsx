import { useKpis } from './api'

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
    </div>
  )
}
