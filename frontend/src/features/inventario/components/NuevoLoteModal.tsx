import { useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Package, Info } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { ApiError } from '@/lib/api'

import { useCreatorLote } from '../api'

function formatearISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const hoyISO = () => formatearISO(new Date())

function sumarDias(fechaISO: string, dias: number): string {
  const partes = fechaISO.split('-').map(Number)
  if (partes.length !== 3 || partes.some(Number.isNaN)) return ''
  const d = new Date(partes[0], partes[1] - 1, partes[2])
  if (isNaN(d.getTime())) return ''
  d.setDate(d.getDate() + dias)
  return formatearISO(d)
}

const esquema = z.object({
  numero_lote: z.string().min(1, 'Ingresa el número de lote'),
  cantidad_inicial: z.string().min(1, 'Ingresa la cantidad').refine((v) => Number(v) > 0, 'La cantidad debe ser mayor a cero'),
  fecha_ingreso: z.string().min(1, 'Selecciona la fecha de ingreso'),
  fecha_vencimiento: z.string().min(1, 'Selecciona la fecha de vencimiento'),
}).refine(
  (v) => !v.fecha_ingreso || !v.fecha_vencimiento || v.fecha_vencimiento >= v.fecha_ingreso,
  'La fecha de vencimiento debe ser posterior o igual a la de ingreso',
)
type FormValues = z.infer<typeof esquema>

export function NuevoLoteModal({
  open,
  onOpenChange,
  productoId,
  productoNombre,
  vidaUtil,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  productoId: number | null
  productoNombre: string
  vidaUtil?: number | null
}) {
  const crear = useCreatorLote()
  const {
    register, handleSubmit, reset, setValue, watch, formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(esquema),
    defaultValues: {
      fecha_ingreso: hoyISO(),
      fecha_vencimiento: vidaUtil && vidaUtil > 0 ? sumarDias(hoyISO(), vidaUtil) : '',
    },
  })

  const vencimientoTocado = useRef(false)
  const fechaIngresoWatch = watch('fecha_ingreso')

  useEffect(() => {
    if (!open) return
    vencimientoTocado.current = false
    const ingreso = hoyISO()
    setValue('fecha_ingreso', ingreso, { shouldValidate: false })
    if (vidaUtil && vidaUtil > 0) {
      setValue('fecha_vencimiento', sumarDias(ingreso, vidaUtil), { shouldValidate: false })
    } else {
      setValue('fecha_vencimiento', '', { shouldValidate: false })
    }
  }, [open, vidaUtil, setValue])

  useEffect(() => {
    if (!open || !vidaUtil || vidaUtil <= 0 || vencimientoTocado.current) return
    if (!fechaIngresoWatch) return
    const venc = sumarDias(fechaIngresoWatch, vidaUtil)
    if (venc) setValue('fecha_vencimiento', venc, { shouldValidate: false })
  }, [open, vidaUtil, fechaIngresoWatch, setValue])

  const sugerencia = vidaUtil && vidaUtil > 0 && fechaIngresoWatch
    ? sumarDias(fechaIngresoWatch, vidaUtil)
    : ''

  function cerrar() {
    vencimientoTocado.current = false
    reset()
    onOpenChange(false)
  }

  async function onSubmit(valores: FormValues) {
    if (!productoId) return
    try {
      await crear.mutateAsync({
        producto: productoId,
        numero_lote: valores.numero_lote,
        cantidad_inicial: valores.cantidad_inicial,
        fecha_ingreso: valores.fecha_ingreso,
        fecha_vencimiento: valores.fecha_vencimiento,
      })
      toast.success('Lote registrado')
      cerrar()
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'No se pudo registrar el lote')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && cerrar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo lote</DialogTitle>
          <DialogDescription>
            {productoNombre} · el número de lote debe ser único por producto.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Número de lote</Label>
            <Input placeholder="Ej. L-2026-001" {...register('numero_lote')} />
            {errors.numero_lote && <p className="text-xs text-destructive">{errors.numero_lote.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Cantidad inicial</Label>
            <Input
              type="number" step="0.01" min="0" placeholder="0"
              {...register('cantidad_inicial')}
            />
            {errors.cantidad_inicial && <p className="text-xs text-destructive">{errors.cantidad_inicial.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Fecha de ingreso</Label>
              <Input type="date" {...register('fecha_ingreso')} />
              {errors.fecha_ingreso && <p className="text-xs text-destructive">{errors.fecha_ingreso.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Fecha de vencimiento</Label>
              <Input
                type="date"
                {...register('fecha_vencimiento')}
                onChange={(e) => {
                  register('fecha_vencimiento').onChange(e)
                  vencimientoTocado.current = true
                }}
              />
              {errors.fecha_vencimiento && <p className="text-xs text-destructive">{errors.fecha_vencimiento.message}</p>}
            </div>
          </div>

          {vidaUtil && vidaUtil > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              La vida útil de esta categoría es de <strong>{vidaUtil} días</strong>.
              {sugerencia && (
                <>
                  {' '}Sugerencia de vencimiento para la fecha de ingreso elegida:{' '}
                  <strong>{sugerencia}</strong>.
                </>
              )}
            </div>
          )}

          {errors.root?.message && <p className="text-xs text-destructive">{errors.root.message}</p>}

          <div className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            <Package className="mt-0.5 size-3.5 shrink-0" />
            La cantidad actual del lote arranca igual a la inicial. Para mover stock (ingreso, salida,
            ajuste) usamos la acción "Movimiento" de la tabla.
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={cerrar}>Cancel</Button>
            <Button type="submit" disabled={crear.isPending}>
              {crear.isPending ? 'Guardando…' : 'Guardar lote'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
