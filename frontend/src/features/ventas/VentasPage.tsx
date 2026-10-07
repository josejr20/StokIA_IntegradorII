import { useState } from 'react'
import { Upload, Calendar, TrendingUp } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/auth/AuthContext'

import { useVentas, useVentasResumen } from './api'
import { ImportarVentasModal } from './ImportarVentasModal'

const formatoMoneda = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' })

export default function VentasPage() {
  const { data, isLoading, isError } = useVentas()
  const { tienePermiso } = useAuth()
  const [importarAbierto, setImportarAbierto] = useState(false)
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  const { data: resumen } = useVentasResumen({ fecha_desde: fechaDesde, fecha_hasta: fechaHasta })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Ventas</h1>
          <p className="mt-1 text-sm text-muted-foreground">Historial de ventas registrado en el backend.</p>
        </div>
        {tienePermiso('importar_ventas') && (
          <Button onClick={() => setImportarAbierto(true)}>
            <Upload className="size-4" />
            Importar historial
          </Button>
        )}
      </div>
      <ImportarVentasModal open={importarAbierto} onOpenChange={setImportarAbierto} />

      <div className="flex flex-wrap items-end gap-4 rounded-xl border bg-white p-4">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Desde</label>
          <Input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Hasta</label>
          <Input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className="w-40" />
        </div>
        {resumen && (
          <div className="ml-auto flex flex-wrap items-end gap-6">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                <TrendingUp className="size-4" />
                Total ventas
              </Badge>
              <strong className="text-lg">{formatoMoneda.format(resumen.total_monto)}</strong>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                <Calendar className="size-4" />
                Cantidad
              </Badge>
              <strong className="text-lg">{resumen.total_cantidad} uds.</strong>
            </div>
          </div>
        )}
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
