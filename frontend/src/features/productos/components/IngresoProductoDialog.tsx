import { useEffect, useState } from 'react'
import { PackagePlus, Info } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { ApiError } from '@/lib/api'

import { useIngresoProducto, type Producto } from '../api'

const formatoMoneda = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' })

/**
 * Ingreso de stock para un producto existente, en dos pasos: primero se
 * pide la cantidad y el precio, después se confirma con el total ya
 * calculado antes de tocar la base de datos. Queda en el kardex con
 * origen "compra".
 */
export function IngresoProductoDialog({
  producto,
  onOpenChange,
}: {
  producto: Producto | null
  onOpenChange: (open: boolean) => void
}) {
  const [paso, setPaso] = useState<1 | 2>(1)
  const [cantidad, setCantidad] = useState('')
  const [precioUnitario, setPrecioUnitario] = useState('')
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState('')
  const ingreso = useIngresoProducto()

  useEffect(() => {
    if (producto) {
      setPaso(1)
      setCantidad('')
      setPrecioUnitario('')
      setMotivo('')
      setError('')
    }
  }, [producto])

  const cantidadNum = Number(cantidad)
  const precioNum = Number(precioUnitario)
  const total = (cantidadNum || 0) * (precioNum || 0)

  function continuar() {
    if (!cantidad || cantidadNum <= 0) {
      setError('Ingresa una cantidad mayor a cero')
      return
    }
    if (!precioUnitario || precioNum < 0) {
      setError('Ingresa un precio unitario válido')
      return
    }
    setError('')
    setPaso(2)
  }

  async function confirmar() {
    if (!producto) return
    try {
      await ingreso.mutateAsync({ id: producto.id, cantidad, precio_unitario: precioUnitario, motivo })
      toast.success(`Se agregaron ${cantidad} unidades a ${producto.nombre}`)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'No se pudo registrar el ingreso')
    }
  }

  return (
    <Dialog open={!!producto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {paso === 1 ? (
          <>
            <DialogHeader>
              <DialogTitle>Ingreso de stock</DialogTitle>
              <DialogDescription>{producto?.nombre} · stock actual: {producto?.stock_total}</DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Cantidad que ingresa</Label>
                <Input
                  type="number" step="0.01" min="0" placeholder="0"
                  value={cantidad} onChange={(e) => setCantidad(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Precio unitario (S/)</Label>
                <Input
                  type="number" step="0.01" min="0" placeholder="0.00"
                  value={precioUnitario} onChange={(e) => setPrecioUnitario(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Motivo (opcional)</Label>
              <Input placeholder="Ej. Compra a proveedor X" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              Este ingreso queda registrado en el Kardex con origen "Compra", con tu usuario y la fecha de hoy.
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={continuar}>Continuar</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="mb-2 grid size-12 place-items-center rounded-full bg-green-100">
                <PackagePlus className="size-6 text-secondary" />
              </div>
              <DialogTitle>¿Confirmas este ingreso?</DialogTitle>
              <DialogDescription>
                Vas a agregar <strong>{cantidad} unidades</strong> de <strong>{producto?.nombre}</strong> a{' '}
                {formatoMoneda.format(precioNum || 0)} cada una. Total: <strong>{formatoMoneda.format(total)}</strong>.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPaso(1)}>Volver</Button>
              <Button disabled={ingreso.isPending} onClick={confirmar}>
                {ingreso.isPending ? 'Registrando…' : 'Sí, agregar al stock'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
