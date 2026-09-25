import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { ArrowDownCircle, ArrowUpCircle, RefreshCcw, Info } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import { ApiError } from '@/lib/api'

import { useRegistrarMovimiento, TIPOS_MOVIMIENTO, ORIGENES_MOVIMIENTO, type TipoMovimiento, type OrigenMovimiento } from '../api'

const esquema = z.object({
  tipo: z.enum(['ingreso', 'salida', 'ajuste'], { message: 'Selecciona un tipo' }),
  cantidad: z.string().min(1, 'Ingresa la cantidad').refine((v) => Number(v) > 0, 'La cantidad debe ser mayor a cero'),
  origen: z.enum(['compra', 'venta', 'inicial', 'ajuste', 'otro']).optional(),
  motivo: z.string().optional(),
  precio_unitario: z.string().optional(),
})
type FormValues = z.infer<typeof esquema>

const ICONO_TIPO: Record<TipoMovimiento, typeof ArrowDownCircle> = {
  ingreso: ArrowDownCircle,
  salida: ArrowUpCircle,
  ajuste: RefreshCcw,
}

export function RegistrarMovimientoModal({
  open,
  onOpenChange,
  loteId,
  loteNumero,
  productoNombre,
  productoCodigo,
  stockActual,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  loteId: number | null
  loteNumero: string
  productoNombre: string
  productoCodigo: string
  stockActual: number
}) {
  const registrar = useRegistrarMovimiento()
  const {
    register, handleSubmit, reset, setValue, watch, formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(esquema),
    defaultValues: { tipo: 'ingreso', origen: 'compra' },
  })

  const tipoWatch = watch('tipo')
  const cantidadWatch = watch('cantidad')
  const precioWatch = watch('precio_unitario')
  const esIngreso = tipoWatch === 'ingreso'
  const cantidadNum = Number(cantidadWatch || 0)
  const precioNum = Number(precioWatch || 0)
  const total = (cantidadNum || 0) * (precioNum || 0)

  const motivoError = tipoWatch !== 'ingreso' && !String(watch('motivo') || '').trim()

  function cerrar() {
    reset()
    onOpenChange(false)
  }

  async function onSubmit(valores: FormValues) {
    if (!loteId) return
    if (!esIngreso && !String(valores.motivo || '').trim()) {
      toast.error('Ingresa el motivo de la salida o ajuste')
      return
    }
    if (!esIngreso && stockActual < cantidadNum) {
      toast.error('Stock insuficiente para esta salida')
      return
    }
    try {
      await registrar.mutateAsync({
        loteId,
        tipo: valores.tipo,
        cantidad: valores.cantidad,
        origen: valores.origen,
        motivo: valores.motivo,
        precio_unitario: valores.precio_unitario,
      })
      toast.success('Movimiento registrado')
      cerrar()
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'No se pudo registrar el movimiento')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && cerrar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Movimiento de inventario</DialogTitle>
          <DialogDescription>
            {productoNombre} · {productoCodigo} · Lote {loteNumero} — stock actual: {stockActual}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Tipo de movimiento</Label>
            <input type="hidden" {...register('tipo')} />
            <div className="grid grid-cols-3 gap-2">
              {TIPOS_MOVIMIENTO.map((t) => {
                const Icono = ICONO_TIPO[t.value]
                const seleccionado = tipoWatch === t.value
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setValue('tipo', t.value)}
                    className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-xs transition-colors ${
                      seleccionado ? 'border-primary bg-primary/5' : 'border-input hover:bg-muted'
                    }`}
                  >
                    <Icono className={`size-5 ${seleccionado ? 'text-primary' : 'text-muted-foreground'}`} />
                    {t.label}
                  </button>
                )
              })}
            </div>
            {errors.tipo && <p className="text-xs text-destructive">{errors.tipo.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Cantidad</Label>
              <Input
                type="number" step="0.01" min="0" placeholder="0"
                {...register('cantidad')}
              />
              {errors.cantidad && <p className="text-xs text-destructive">{errors.cantidad.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Origen</Label>
              <input type="hidden" {...register('origen')} />
              <Select
                value={watch('origen') || 'compra'}
                onValueChange={(v) => setValue('origen', v as OrigenMovimiento)}
              >
                <SelectTrigger><SelectValue placeholder="Origen" /></SelectTrigger>
                <SelectContent>
                  {ORIGENES_MOVIMIENTO.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {esIngreso && (
            <div className="space-y-1.5">
              <Label>Precio unitario (opcional)</Label>
              <Input
                type="number" step="0.01" min="0" placeholder="0.00"
                {...register('precio_unitario')}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Motivo {esIngreso ? '(opcional)' : '(obligatorio)'}</Label>
            <Input placeholder="Ej. Compra a proveedor X" {...register('motivo')} />
            {motivoError && <p className="text-xs text-destructive">Ingresa el motivo de la salida o ajuste</p>}
          </div>

          {esIngreso && cantidadNum > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3 text-sm">
              <Info className="size-4 text-muted-foreground" />
              <span>
                Total a registrar: <strong>{new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(total)}</strong>
              </span>
            </div>
          )}

          <div className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            El saldo del producto se actualiza con promedio ponderado. Para salidas y ajustes se usa el
            costo promedio vigente.
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={cerrar}>Cancel</Button>
            <Button type="submit" disabled={registrar.isPending}>
              {registrar.isPending ? 'Registrando…' : 'Registrar movimiento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}