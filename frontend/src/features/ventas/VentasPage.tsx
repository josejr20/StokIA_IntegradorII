import { useVentas } from './api'

export default function VentasPage() {
  const { data, isLoading, isError } = useVentas()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Ventas</h1>
        <p className="mt-1 text-sm text-muted-foreground">Historial de ventas registrado en el backend.</p>
      </div>
      {isLoading && <p className="text-muted-foreground">Cargando ventas...</p>}
      {isError && <p className="text-destructive">No se pudieron cargar las ventas.</p>}
      {data && (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-muted-foreground">
              <tr><th className="p-4">Fecha</th><th className="p-4">Producto</th><th className="p-4">Cantidad</th><th className="p-4">Origen</th></tr>
            </thead>
            <tbody className="divide-y">
              {data.map((venta) => (
                <tr key={venta.id}>
                  <td className="p-4">{new Date(venta.fecha_venta).toLocaleDateString('es-PE')}</td>
                  <td className="p-4 font-medium">{venta.producto_nombre ?? 'Sin producto'}</td>
                  <td className="p-4">{venta.cantidad}</td>
                  <td className="p-4 text-muted-foreground">{venta.origen}</td>
                </tr>
              ))}
              {data.length === 0 && <tr><td className="p-4 text-muted-foreground" colSpan={4}>No hay ventas registradas.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
