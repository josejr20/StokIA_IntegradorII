import { AlertTriangle, CheckCircle2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'

/**
 * Confirmación genérica (patrón "04f · Modal Desactivar producto" en
 * Figma). Se reutiliza para cualquier confirmación de un solo paso:
 * desactivar, reactivar, rechazar una orden, descartar una alerta, etc.
 * `variante="destructiva"` (default) es roja, para acciones que restan.
 * `variante="positiva"` es verde, para acciones que devuelven algo a su
 * estado normal (como reactivar).
 */
interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  titulo: string
  descripcion: string
  textoConfirmar?: string
  cargando?: boolean
  variante?: 'destructiva' | 'positiva'
  onConfirmar: () => void
}

export function ConfirmDialog({
  open,
  onOpenChange,
  titulo,
  descripcion,
  textoConfirmar = 'Sí, desactivar',
  cargando,
  variante = 'destructiva',
  onConfirmar,
}: ConfirmDialogProps) {
  const esPositiva = variante === 'positiva'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className={`mb-2 grid size-12 place-items-center rounded-full ${esPositiva ? 'bg-green-100' : 'bg-red-100'}`}>
            {esPositiva
              ? <CheckCircle2 className="size-6 text-secondary" />
              : <AlertTriangle className="size-6 text-destructive" />}
          </div>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descripcion}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant={esPositiva ? 'secondary' : 'destructive'} disabled={cargando} onClick={onConfirmar}>
            {cargando ? 'Procesando…' : textoConfirmar}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
