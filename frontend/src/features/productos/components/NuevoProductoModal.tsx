import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { ApiError } from '@/lib/api'

import { useCategorias, useUnidadesMedida, usePresentaciones, useCrearProducto } from '../api'
import { ImagenInput } from './ImagenInput'

// La fecha mínima seleccionable es mañana: ni hoy ni antes.
function manana() {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() + 1)
  return fecha.toISOString().slice(0, 10)
}

// HU02: registrar nuevo producto, con el primer lote opcional en el mismo paso
const esquema = z.object({
  nombre: z.string().min(2, 'Ingresa un nombre'),
  categoria: z.string().min(1, 'Selecciona una categoría'),
  unidad_medida: z.string().min(1, 'Selecciona una unidad'),
  presentacion: z.string().optional(),
  lote_cantidad: z.string().optional(),
  lote_vencimiento: z.string().optional(),
}).refine((v) => !v.lote_cantidad || !!v.lote_vencimiento, {
  message: 'Si registras stock inicial, indica también la fecha de vencimiento',
  path: ['lote_vencimiento'],
}).refine((v) => !v.lote_vencimiento || v.lote_vencimiento >= manana(), {
  message: 'La fecha de vencimiento debe ser posterior a hoy',
  path: ['lote_vencimiento'],
})
type FormValues = z.infer<typeof esquema>

export function NuevoProductoModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: categorias } = useCategorias()
  const { data: unidades } = useUnidadesMedida()
  const { data: presentaciones } = usePresentaciones()
  const crear = useCrearProducto()
  const [imagen, setImagen] = useState<File | null>(null)

  const {
    control, register, handleSubmit, reset, formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(esquema) })

  function cerrar() {
    reset()
    setImagen(null)
    onOpenChange(false)
  }

  async function onSubmit(valores: FormValues) {
    try {
      await crear.mutateAsync({
        nombre: valores.nombre,
        categoria: valores.categoria,
        unidad_medida: valores.unidad_medida,
        presentacion: valores.presentacion,
        imagen,
        lote_cantidad: valores.lote_cantidad,
        lote_vencimiento: valores.lote_vencimiento,
      })
      toast.success('Producto registrado')
      cerrar()
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'No se pudo registrar el producto')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && cerrar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo producto</DialogTitle>
          <DialogDescription>El código se genera automático al guardar.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <ImagenInput onChange={setImagen} />

          <div className="space-y-1.5">
            <Label>Nombre del producto</Label>
            <Input placeholder="Ej. Comino molido" {...register('nombre')} />
            {errors.nombre && <p className="text-xs text-destructive">{errors.nombre.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Unidad (kg, gr, lt, ml…)</Label>
              <Controller
                control={control}
                name="unidad_medida"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {unidades?.results.map((u) => (
                        <SelectItem key={u.id} value={String(u.id)}>{u.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.unidad_medida && <p className="text-xs text-destructive">{errors.unidad_medida.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Presentación (cantidad)</Label>
              <Controller
                control={control}
                name="presentacion"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                    <SelectContent>
                      {presentaciones?.results.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Categoría</Label>
            <Controller
              control={control}
              name="categoria"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar categoría" /></SelectTrigger>
                  <SelectContent>
                    {categorias?.results.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.categoria && <p className="text-xs text-destructive">{errors.categoria.message}</p>}
          </div>

          <div className="rounded-lg border border-dashed p-3">
            <p className="mb-3 text-xs font-medium text-muted-foreground">
              Stock inicial (opcional) — si lo dejas vacío, registras el producto sin lote y lo agregas después desde Inventario.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Cantidad que ingresa</Label>
                <Input type="number" step="0.01" min="0" placeholder="0" {...register('lote_cantidad')} />
              </div>
              <div className="space-y-1.5">
                <Label>Vence el</Label>
                <Input type="date" min={manana()} {...register('lote_vencimiento')} />
              </div>
            </div>
            {errors.lote_vencimiento && (
              <p className="mt-1.5 text-xs text-destructive">{errors.lote_vencimiento.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={cerrar}>Cancelar</Button>
            <Button type="submit" disabled={crear.isPending}>
              {crear.isPending ? 'Guardando…' : 'Guardar producto'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
