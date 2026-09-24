import { useResumenInicio } from '@/features/dashboard/api'

export default function InicioPage() {
  const { data, isLoading, isError } = useResumenInicio()
  const kpis = data?.kpis

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Resumen de inventario</h1>
        <p className="mt-1 text-sm text-muted-foreground">Datos actualizados desde StockIA.</p>
      </div>
      {isLoading && <p className="text-muted-foreground">Cargando resumen...</p>}
      {isError && <p className="text-destructive">No se pudo cargar el resumen.</p>}
      {kpis && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ['Productos activos', kpis.productos_activos],
            ['Ventas del mes', kpis.ventas_mes_actual],
            ['Alertas activas', kpis.alertas_activas],
            ['Alertas críticas', kpis.alertas_criticas],
            ['Órdenes pendientes', kpis.ordenes_pendientes],
          ].map(([etiqueta, valor]) => (
            <div key={etiqueta} className="rounded-xl border bg-white p-4">
              <p className="text-sm text-muted-foreground">{etiqueta}</p>
              <p className="mt-2 text-2xl font-semibold">{valor}</p>
            </div>
          ))}
        </div>
      )}
      {data && (
        <div className="rounded-xl border bg-white p-5">
          <h2 className="font-semibold">Alertas recientes</h2>
          <div className="mt-4 divide-y">
            {data.alertas_recientes.length === 0 && <p className="py-3 text-sm text-muted-foreground">No hay alertas activas.</p>}
            {data.alertas_recientes.map((alerta) => (
              <div key={alerta.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                <span>{alerta.mensaje}</span>
                <span className="text-muted-foreground">{alerta.severidad}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
