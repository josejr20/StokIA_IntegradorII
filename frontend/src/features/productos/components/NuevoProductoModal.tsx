import { useMemo, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { ApiError } from '@/lib/api'

import {
  useCreacionProducto, useCategorias, useUnidadesMedida, useMarcas, useTiposEnvase,
} from '../api'
import { ImagenInput } from './ImagenInput'

interface FormValues {
  nombre: string
  categoria: string
  marca: string
  contenido_valor: string
  unidad_medida: string
  categoria_paquete: string
  contenido_paquete_cantidad: string
  contenido_paquete_envase: string
  precio_venta: string
  descripcion: string
}

export function NuevoProductoModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: categorias } = useCategorias()
  const { data: unidades } = useUnidadesMedida()
  const { data: marcas } = useMarcas()
  const { data: tiposEnvase } = useTiposEnvase()
  const crear = useCreacionProducto()
  const [imagen, setImagen] = useState<File | null>(null)

  const {
    control, register, handleSubmit, reset, watch, formState: { isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      nombre: '', categoria: '', marca: '', contenido_valor: '', unidad_medida: '',
      categoria_paquete: '', contenido_paquete_cantidad: '', contenido_paquete_envase: '',
      precio_venta: '', descripcion: '',
    },
  })

  const nombreBase = watch('nombre')
  const contenidoValor = watch('contenido_valor')
  const unidadId = watch('unidad_medida')
  const categoriaPaqueteId = watch('categoria_paquete')
  const contenidoPaqueteCantidad = watch('contenido_paquete_cantidad')
  const contenidoPaqueteEnvaseId = watch('contenido_paquete_envase')

  const unidadSeleccionada = unidades?.results.find((u) => String(u.id) === unidadId)
  const categoriaPaqueteSeleccionada = tiposEnvase?.results.find((e) => String(e.id) === categoriaPaqueteId)
  const contenidoEnvaseSeleccionado = tiposEnvase?.results.find((e) => String(e.id) === contenidoPaqueteEnvaseId)

  // Vista previa: "AJI-NO-MEN CARNE 80 GR UNIDAD X24 SOBRES"
  const nombreCompleto = useMemo(() => {
    const partes: string[] = []
    if (nombreBase.trim()) partes.push(nombreBase.trim())
    if (contenidoValor && unidadSeleccionada) partes.push(`${contenidoValor} ${unidadSeleccionada.simbolo}`)
    if (categoriaPaqueteSeleccionada) partes.push(categoriaPaqueteSeleccionada.nombre)
    if (contenidoPaqueteCantidad && contenidoEnvaseSeleccionado) {
      partes.push(`X${contenidoPaqueteCantidad} ${contenidoEnvaseSeleccionado.nombre}`)
    }
    return partes.join(' ')
  }, [nombreBase, contenidoValor, unidadSeleccionada, categoriaPaqueteSeleccionada, contenidoPaqueteCantidad, contenidoEnvaseSeleccionado])

  function cerrar() {
    reset()
    setImagen(null)
    onOpenChange(false)
  }

  async function onSubmit(valores: FormValues) {
    const tieneCantidad = Boolean(valores.contenido_paquete_cantidad)
    const tieneEnvase = Boolean(valores.contenido_paquete_envase)
    if (tieneCantidad !== tieneEnvase) {
      toast.error('Completa la cantidad y el envase del contenido del paquete, o deja ambos vacíos')
      return
    }

    try {
      await crear.mutateAsync({
        nombre: valores.nombre,
        categoria: valores.categoria,
        marca: valores.marca || undefined,
        contenido_valor: valores.contenido_valor ? Number(valores.contenido_valor) : undefined,
        unidad_medida: valores.unidad_medida,
        categoria_paquete: Number(valores.categoria_paquete),
        contenido_paquete_cantidad: tieneCantidad ? Number(valores.contenido_paquete_cantidad) : undefined,
        contenido_paquete_envase: tieneEnvase ? Number(valores.contenido_paquete_envase) : undefined,
        precio_venta: valores.precio_venta || undefined,
        descripcion: valores.descripcion || undefined,
        imagen,
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
          <DialogDescription>
            Completa la ficha del producto. El código se genera automáticamente al guardar.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <ImagenInput onChange={setImagen} />

          <div className="space-y-1.5">
            <Label>Nombre comercial *</Label>
            <Input {...register('nombre', { required: 'Ingresa un nombre' })} placeholder="Ej. AJI-NO-MEN CARNE" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Categoria *</Label>
              <Controller
                control={control}
                name="categoria"
                rules={{ required: 'Selecciona una categoria' }}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {categorias?.results.map((categoria) => (
                        <SelectItem key={categoria.id} value={String(categoria.id)}>{categoria.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
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
                      {marcas?.results.map((marca) => (
                        <SelectItem key={marca.id} value={String(marca.id)}>{marca.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Contenido</Label>
              <Input type="number" step="0.01" min="0" placeholder="Ej. 80" {...register('contenido_valor')} />
            </div>

            <div className="space-y-1.5">
              <Label>Unidad de medida *</Label>
              <Controller
                control={control}
                name="unidad_medida"
                rules={{ required: 'Selecciona una unidad' }}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="Ej. GR" /></SelectTrigger>
                    <SelectContent>
                      {unidades?.results.map((u) => (
                        <SelectItem key={u.id} value={String(u.id)}>{u.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-lg border p-4">
            <div>
              <h3 className="text-sm font-semibold">Paquete</h3>
              <p className="text-xs text-muted-foreground">Cómo se vende este producto y qué trae adentro.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Categoría de paquete *</Label>
                <Controller
                  control={control}
                  name="categoria_paquete"
                  rules={{ required: 'Selecciona una categoría de paquete' }}
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
            <p className="text-xs text-muted-foreground">
              Deja "Contenido del paquete" vacío si el producto se vende suelto y no trae nada adentro.
            </p>
          </div>

          {nombreCompleto && (
            <div className="rounded-lg border border-dashed p-3 text-sm">
              Se va a mostrar como: <strong>{nombreCompleto}</strong>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Precio de venta (S/.)</Label>
            <Input type="number" step="0.01" {...register('precio_venta')} />
          </div>

          <div className="space-y-1.5">
            <Label>Descripción (opcional)</Label>
            <Input {...register('descripcion')} placeholder="Detalles adicionales del producto…" />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={cerrar}>Cancelar</Button>
            <Button type="submit" disabled={crear.isPending || isSubmitting}>
              {crear.isPending || isSubmitting ? 'Guardando…' : 'Guardar producto'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}