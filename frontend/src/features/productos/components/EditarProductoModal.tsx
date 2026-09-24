import { useEffect, useMemo, useState } from 'react'
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
  useActualizarProducto, useCategorias, useUnidadesMedida, useMarcas, useTiposEnvase, type Producto,
} from '../api'
import { ImagenInput } from './ImagenInput'

// HU03: solo se editan características de la ficha; el código, el stock y
// el estado no aparecen como campos editables en este formulario.
const esquema = z
  .object({
    nombre: z.string().min(2, 'Ingresa un nombre'),
    categoria: z.string().min(1, 'Selecciona una categoría'),
    marca: z.string().optional(),
    contenido_valor: z.string().optional(),
    unidad_medida: z.string().min(1, 'Selecciona una unidad'),
    categoria_paquete: z.string().min(1, 'Selecciona una categoría de paquete'),
    contenido_paquete_cantidad: z.string().optional(),
    contenido_paquete_envase: z.string().optional(),
    precio_venta: z.string().optional(),
    descripcion: z.string().optional(),
  })
  .refine(
    (valores) => Boolean(valores.contenido_paquete_cantidad) === Boolean(valores.contenido_paquete_envase),
    {
      message: 'Completa la cantidad y el envase del contenido del paquete, o deja ambos vacíos',
      path: ['contenido_paquete_envase'],
    },
  )

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
  const { data: marcas } = useMarcas()
  const { data: tiposEnvase } = useTiposEnvase()
  const actualizar = useActualizarProducto()
  const [imagen, setImagen] = useState<File | null>(null)

  const {
    control, register, handleSubmit, reset, watch, formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(esquema) })

  useEffect(() => {
    if (producto) {
      reset({
        nombre: producto.nombre,
        categoria: producto.categoria ? String(producto.categoria) : '',
        marca: producto.marca ? String(producto.marca) : undefined,
        contenido_valor: producto.contenido_valor != null ? String(producto.contenido_valor) : '',
        unidad_medida: producto.unidad_medida ? String(producto.unidad_medida) : '',
            categoria_paquete: producto.categoria_paquete_id ? String(producto.categoria_paquete_id) : '',
        contenido_paquete_cantidad: producto.contenido_paquete_cantidad != null
          ? String(producto.contenido_paquete_cantidad)
          : '',
        contenido_paquete_envase: producto.contenido_paquete_envase_id
          ? String(producto.contenido_paquete_envase_id)
          : undefined,
        precio_venta: producto.precio_venta ?? undefined,
        descripcion: producto.descripcion ?? undefined,
      })
      setImagen(null)
    }
  }, [producto, reset])

  const nombreBase = watch('nombre')
  const contenidoValor = watch('contenido_valor')
  const unidadId = watch('unidad_medida')
  const categoriaPaqueteId = watch('categoria_paquete')
  const contenidoPaqueteCantidad = watch('contenido_paquete_cantidad')
  const contenidoPaqueteEnvaseId = watch('contenido_paquete_envase')

  const unidadSeleccionada = unidades?.results.find((u) => String(u.id) === unidadId)
  const categoriaPaqueteSeleccionada = tiposEnvase?.results.find((e) => String(e.id) === categoriaPaqueteId)
  const contenidoEnvaseSeleccionado = tiposEnvase?.results.find((e) => String(e.id) === contenidoPaqueteEnvaseId)

  // Misma vista previa que en "Nuevo producto": se arma sola, no se vuelve a tipear.
  const nombreCompleto = useMemo(() => {
    const partes: string[] = []
    if (nombreBase?.trim()) partes.push(nombreBase.trim())
    if (contenidoValor && unidadSeleccionada) partes.push(`${contenidoValor} ${unidadSeleccionada.simbolo}`)
    if (categoriaPaqueteSeleccionada) partes.push(categoriaPaqueteSeleccionada.nombre)
    if (contenidoPaqueteCantidad && contenidoEnvaseSeleccionado) {
      partes.push(`X${contenidoPaqueteCantidad} ${contenidoEnvaseSeleccionado.nombre}`)
    }
    return partes.join(' ')
  }, [nombreBase, contenidoValor, unidadSeleccionada, categoriaPaqueteSeleccionada, contenidoPaqueteCantidad, contenidoEnvaseSeleccionado])

  async function onSubmit(valores: FormValues) {
    if (!producto) return
    try {
      await actualizar.mutateAsync({
        id: producto.id,
        datos: {
          nombre: valores.nombre,
          categoria: valores.categoria,
          marca: valores.marca,
          contenido_valor: valores.contenido_valor ? Number(valores.contenido_valor) : undefined,
          unidad_medida: valores.unidad_medida,
          categoria_paquete: Number(valores.categoria_paquete),
          contenido_paquete_cantidad: valores.contenido_paquete_cantidad
            ? Number(valores.contenido_paquete_cantidad)
            : undefined,
          contenido_paquete_envase: valores.contenido_paquete_envase
            ? Number(valores.contenido_paquete_envase)
            : undefined,
          precio_venta: valores.precio_venta,
          descripcion: valores.descripcion,
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
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar producto</DialogTitle>
          <DialogDescription>
            {producto?.codigo} · {producto?.nombre} — el código, el stock y el estado no se editan desde aquí.
          </DialogDescription>
        </DialogHeader>

        {producto && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <ImagenInput imagenActual={producto.imagen} onChange={setImagen} />

            <div className="space-y-1.5">
              <Label>Nombre comercial</Label>
              <Input {...register('nombre')} />
              {errors.nombre && <p className="text-xs text-destructive">{errors.nombre.message}</p>}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                <Label>Marca</Label>
                <Controller
                  control={control}
                  name="marca"
                  render={({ field }) => (
                    <Select value={field.value ?? ''} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                      <SelectContent>
                        {marcas?.results.map((m) => (
                          <SelectItem key={m.id} value={String(m.id)}>{m.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Contenido</Label>
                <Input type="number" step="0.01" min="0" {...register('contenido_valor')} />
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

            <div className="space-y-3 rounded-lg border p-4">
              <div>
                <h3 className="text-sm font-semibold">Paquete</h3>
                <p className="text-xs text-muted-foreground">Cómo se vende este producto y qué trae adentro.</p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Categoría de paquete</Label>
                  <Controller
                    control={control}
                    name="categoria_paquete"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue placeholder="Ej. UNIDAD, CAJA" /></SelectTrigger>
                        <SelectContent>
                          {tiposEnvase?.results.map((envase) => (
                            <SelectItem key={envase.id} value={String(envase.id)}>{envase.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.categoria_paquete && (
                    <p className="text-xs text-destructive">{errors.categoria_paquete.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>Contenido del paquete</Label>
                  <Input type="number" min="0.01" step="0.01" placeholder="Ej. 24" {...register('contenido_paquete_cantidad')} />
                </div>

                <div className="space-y-1.5">
                  <Label>Envase del contenido</Label>
                  <Controller
                    control={control}
                    name="contenido_paquete_envase"
                    render={({ field }) => (
                      <Select value={field.value ?? ''} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue placeholder="Ej. SOBRES, TIRAS" /></SelectTrigger>
                        <SelectContent>
                          {tiposEnvase?.results.map((envase) => (
                            <SelectItem key={envase.id} value={String(envase.id)}>{envase.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>
              {errors.contenido_paquete_envase && (
                <p className="text-xs text-destructive">{errors.contenido_paquete_envase.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Deja "Contenido del paquete" vacío si el producto se vende suelto y no trae nada adentro.
              </p>
            </div>

            {nombreCompleto && (
              <div className="rounded-lg border border-dashed p-3 text-sm">
                Se va a mostrar como: <strong>{nombreCompleto}</strong>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Precio de venta (S/.)</Label>
                <Input type="number" step="0.01" {...register('precio_venta')} />
              </div>
              <div className="space-y-1.5">
                <Label>Descripción (opcional)</Label>
                <Input {...register('descripcion')} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 rounded-lg border border-dashed p-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Código</Label>
                <p className="text-sm font-medium">{producto.codigo}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Stock actual</Label>
                <p className="text-sm font-medium">{producto.stock_total}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Estado</Label>
                <Badge variant={producto.activo ? 'bajo' : 'secondary'}>
                  {producto.activo ? 'Activo' : 'Inactivo'}
                </Badge>
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