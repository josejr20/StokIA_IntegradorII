import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { ApiError } from '@/lib/api'
import {
  useActualizarProducto, useCategorias, useUnidadesMedida, usePresentaciones, type Producto,
} from '../api'
import { ImagenInput } from './ImagenInput'

// HU03: solo se editan características de la ficha; el estado y el código
// no aparecen como campos editables en este formulario.
const esquema = z.object({
  nombre: z.string().min(2, 'Ingresa un nombre'),
  categoria: z.string().min(1, 'Selecciona una categoría'),
  unidad_medida: z.string().min(1, 'Selecciona una unidad'),
  presentacion: z.string().optional(),
})
type FormValues = z.infer<typeof esquema>

export function EditarProductoModal({
  producto,
  onOpenChange,
}: {
  producto: Producto | null
  onOpenChange: (open: boolean) => void
}) {
  const { data: categorias } = useCategorias()
  const { data: unidades } = useUnidadesMedida()
  const { data: presentaciones } = usePresentaciones()
  const actualizar = useActualizarProducto()
  const [imagen, setImagen] = useState<File | null>(null)

  const { control, register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(esquema),
  })

  useEffect(() => {
    if (producto) {
      reset({
        nombre: producto.nombre,
        categoria: producto.categoria ? String(producto.categoria) : '',
        unidad_medida: producto.unidad_medida ? String(producto.unidad_medida) : '',
        presentacion: producto.presentacion ? String(producto.presentacion) : undefined,
      })
      setImagen(null)
    }
  }, [producto, reset])

  async function onSubmit(valores: FormValues) {
    if (!producto) return
    try {
      await actualizar.mutateAsync({
        id: producto.id,
        datos: {
          nombre: valores.nombre,
          categoria: valores.categoria,
          unidad_medida: valores.unidad_medida,
          presentacion: valores.presentacion,
          imagen,
        },
      })
      toast.success('Producto actualizado')
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'No se pudo actualizar el producto')
    }
  }

  return (
    <Dialog open={!!producto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar producto</DialogTitle>
          <DialogDescription>
            {producto?.codigo} · {producto?.nombre} — el código, el stock y el estado no se editan desde aquí.
          </DialogDescription>
        </DialogHeader>

        {producto && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <ImagenInput imagenActual={producto.imagen} onChange={setImagen} />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Código</Label>
                <Input value={producto.codigo} disabled className="bg-muted" />
              </div>
              <div className="space-y-1.5">
                <Label>Unidad de medida</Label>
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
            </div>

            <div className="space-y-1.5">
              <Label>Nombre del producto</Label>
              <Input {...register('nombre')} />
              {errors.nombre && <p className="text-xs text-destructive">{errors.nombre.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Categoría</Label>
                <Controller
                  control={control}
                  name="categoria"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
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
              <div className="space-y-1.5">
                <Label>Presentación</Label>
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Stock actual</Label>
                <Input value={producto.stock_total} disabled className="bg-muted" />
              </div>
              <div className="space-y-1.5">
                <Label>Estado</Label>
                <div>
                  <Badge variant={producto.activo ? 'bajo' : 'secondary'}>
                    {producto.activo ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={actualizar.isPending}>
                {actualizar.isPending ? 'Guardando…' : 'Guardar cambios'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
