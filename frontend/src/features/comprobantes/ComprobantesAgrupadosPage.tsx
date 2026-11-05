import { useState } from 'react'
import { ReceiptText } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ComprobanteModal } from '@/features/operaciones/components/ComprobanteModal'
import type { Comprobante } from '@/types'

interface ComprobanteAgrupado {
  id: string
  cliente_id: number | null
  cliente: { id: number; nombre: string; documento: string | null } | null
  fecha: string
  operaciones_count: number
  numeros_operacion: string[]
  items: Array<{ producto_id: number; codigo: string; producto: string; cantidad: number; precio_unitario: number; subtotal: number }>
  subtotal: number
  impuesto: number
  total: number
  vendedor: { nombres: string; apellidos: string } | null
}

function formatearMoneda(valor: number) {
  return `S/ ${valor.toFixed(2)}`
}

function obtenerFechaActualLima() {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const componentes = Object.fromEntries(partes.map(({ type, value }) => [type, value]))
  return `${componentes.year}-${componentes.month}-${componentes.day}`
}

export default function ComprobantesAgrupadosPage() {
  const [fecha, setFecha] = useState(obtenerFechaActualLima)
  const [comprobante, setComprobante] = useState<Comprobante | null>(null)

  const { data: comprobantes, isLoading } = useQuery({
    queryKey: ['comprobantes-agrupados', fecha],
    queryFn: async () => {
      const res = await api.get<{ data: ComprobanteAgrupado[] }>(`/comprobantes?fecha=${fecha}`)
      return res.data
    },
  })

  async function verComprobante(id: string) {
    const res = await api.get<{ data: any }>(`/comprobantes/${encodeURIComponent(id)}`)
    const datos = res.data
    setComprobante({
      id: 0,
      operacion_id: 0,
      numero: datos.numero_comprobante,
      tipo: 'boleta',
      datos,
      fecha_creacion: datos.fecha,
    } as Comprobante)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Comprobantes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Comprobantes agrupados por cliente y fecha
          </p>
        </div>
        <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-48" />
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-muted-foreground">
              <th className="p-4">Cliente</th>
              <th className="p-4">Operaciones</th>
              <th className="p-4">Números</th>
              <th className="p-4 text-right">Total</th>
              <th className="p-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && <tr><td className="p-4 text-muted-foreground" colSpan={5}>Cargando...</td></tr>}
            {comprobantes?.map((c) => (
              <tr key={c.id}>
                <td className="p-4">
                  <p className="font-medium">{c.cliente?.nombre ?? 'Sin cliente'}</p>
                  {c.cliente?.documento && <p className="text-xs text-muted-foreground">{c.cliente.documento}</p>}
                </td>
                <td className="p-4">{c.operaciones_count}</td>
                <td className="p-4 text-xs text-muted-foreground">{(c.numeros_operacion || []).join(', ')}</td>
                <td className="p-4 text-right font-medium">{formatearMoneda(c.total)}</td>
                <td className="p-4 text-right">
                  <Button variant="ghost" size="sm" onClick={() => verComprobante(c.id)}>
                    <ReceiptText className="size-4" />
                    Ver comprobante
                  </Button>
                </td>
              </tr>
            ))}
            {!isLoading && comprobantes?.length === 0 && (
              <tr><td className="p-4 text-center text-muted-foreground" colSpan={5}>No hay ventas para esta fecha</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <ComprobanteModal comprobante={comprobante} onCerrar={() => setComprobante(null)} />
    </div>
  )
}
