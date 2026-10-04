import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { ApiError } from '@/lib/api'
import type { Producto } from '@/types'

import { useCreatorLote } from '../api'

function formatearISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const hoyISO = () => formatearISO(new Date())

const esquema = z.object({
  cantidad_inicial: z.string().min(1, 'Ingresa la cantidad').refine((v) => Number(v) > 0, 'La cantidad debe ser mayor a cero'),
  fecha_ingreso: z.string().min(1, 'Selecciona la fecha de ingreso'),
})
type FormValues = z.infer<typeof esquema>

export function NuevoLoteModal({
  open,
  onOpenChange,
  productos,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  productos: Producto[]
}) {
  const [productoId, setProductoId] = useState('')
  const producto = productos.find((p) => String(p.id) === productoId)
  const crear = useCreatorLote()
  const {
    register, handleSubmit, reset, setValue, formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(esquema),
    defaultValues: {
      cantidad_inicial: '',
      fecha_ingreso: hoyISO(),
    },
  })

  useEffect(() => {
    if (!open) return
    setProductoId('')
    reset({
      cantidad_inicial: '',
      fecha_ingreso: hoyISO(),
    })
  }, [open, reset])

  useEffect(() => {
    if (!open || !productoId) return
    setValue('fecha_ingreso', hoyISO(), { shouldValidate: false })
    setValue('cantidad_inicial', '', { shouldValidate: false })
  }, [open, productoId, setValue])

  function cerrar() {
    reset()
    setProductoId('')
    onOpenChange(false)
  }

  async function onSubmit(valores: FormValues) {
    if (!producto) return
    try {
      await crear.mutateAsync({
        producto: producto.id,
        cantidad_inicial: valores.cantidad_inicial,
        fecha_ingreso: valores.fecha_ingreso,
      })
      toast.success(`Ingreso registrado en un nuevo lote de ${producto.nombre}`)
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
            Selecciona un producto para consultar su stock y registrar un ingreso en un lote nuevo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Producto</Label>
            <Select value={productoId} onValueChange={setProductoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un producto" />
              </SelectTrigger>
              <SelectContent>
                {productos.map((opcion) => (
                  <SelectItem
                    key={opcion.id}
                    value={String(opcion.id)}
                    disabled={!opcion.activo}
                  >
                    {opcion.codigo} · {opcion.nombre}{!opcion.activo ? ' (Inactivo)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {producto && (
            <>
              <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Código</p>
                  <p className="font-medium">{producto.codigo}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Stock actual</p>
                  <p className="font-medium">
                    {producto.stock_total} {producto.unidad_medida_simbolo ?? ''}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Producto</p>
                  <p className="font-medium">{producto.nombre}</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Cantidad que ingresa</Label>
                <Input
                  type="number" step="0.01" min="0" placeholder="0"
                  {...register('cantidad_inicial')}
                />
                {errors.cantidad_inicial && <p className="text-xs text-destructive">{errors.cantidad_inicial.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label>Fecha de ingreso</Label>
                <Input type="date" {...register('fecha_ingreso')} />
                {errors.fecha_ingreso && <p className="text-xs text-destructive">{errors.fecha_ingreso.message}</p>}
              </div>
            </>
          )}

          {errors.root?.message && <p className="text-xs text-destructive">{errors.root.message}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={cerrar}>Cancelar</Button>
            <Button type="submit" disabled={!producto || crear.isPending}>
              {crear.isPending ? 'Guardando…' : 'Guardar lote'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
