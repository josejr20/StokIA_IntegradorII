import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { ApiError } from '@/lib/api'

import { useDesactivarProducto, MOTIVOS_DESACTIVACION, type MotivoDesactivacion, type Producto } from '../api'

/**
 * HU05: doble confirmación. Paso 1 pide el motivo (obligatorio para el
 * backend). Paso 2 es la confirmación final, ya sin forma de cambiar de
 * opinión sobre el motivo, solo de cancelar o confirmar.
 */
export function DesactivarProductoDialog({
  producto,
  onOpenChange,
}: {
  producto: Producto | null
  onOpenChange: (open: boolean) => void
}) {
  const [paso, setPaso] = useState<1 | 2>(1)
  const [motivo, setMotivo] = useState<MotivoDesactivacion | ''>('')
  const [detalle, setDetalle] = useState('')
  const desactivar = useDesactivarProducto()

  useEffect(() => {
    if (producto) {
      setPaso(1)
      setMotivo('')
      setDetalle('')
    }
  }, [producto])

  async function confirmar() {
    if (!producto || !motivo) return
    try {
      await desactivar.mutateAsync({ id: producto.id, motivo, detalle: detalle || undefined })
      toast.success('Producto desactivado')
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'No se pudo desactivar el producto')
    }
  }

  const motivoLabel = MOTIVOS_DESACTIVACION.find((m) => m.value === motivo)?.label

  return (
    <Dialog open={!!producto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {paso === 1 ? (
          <>
            <DialogHeader>
              <DialogTitle>Desactivar producto</DialogTitle>
              <DialogDescription>{producto?.nombre} — indica el motivo antes de continuar.</DialogDescription>
            </DialogHeader>

            <div className="space-y-1.5">
              <Label>Motivo de desactivación</Label>
              <Select value={motivo} onValueChange={(v) => setMotivo(v as MotivoDesactivacion)}>
                <SelectTrigger><SelectValue placeholder="Selecciona un motivo" /></SelectTrigger>
                <SelectContent>
                  {MOTIVOS_DESACTIVACION.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {motivo === 'otro' && (
              <div className="space-y-1.5">
                <Label>Cuéntanos brevemente por qué</Label>
                <Input value={detalle} onChange={(e) => setDetalle(e.target.value)} placeholder="Motivo" />
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button
                variant="destructive"
                disabled={!motivo || (motivo === 'otro' && !detalle.trim())}
                onClick={() => setPaso(2)}
              >
                Continuar
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="mb-2 grid size-12 place-items-center rounded-full bg-red-100">
                <AlertTriangle className="size-6 text-destructive" />
              </div>
              <DialogTitle>¿Confirmas la desactivación?</DialogTitle>
              <DialogDescription>
                {producto?.nombre} dejará de aparecer en el catálogo activo y no podrá venderse. Se conservará
                su historial de movimientos. Motivo registrado: <strong>{motivoLabel}</strong>.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPaso(1)}>Volver</Button>
              <Button variant="destructive" disabled={desactivar.isPending} onClick={confirmar}>
                {desactivar.isPending ? 'Desactivando…' : 'Sí, desactivar definitivamente'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
