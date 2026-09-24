import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { UserPlus, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError } from '@/lib/api'

import { useCrearUsuario, useRoles } from './api'

const ROL_OBJETIVO = 'Encargado de Inventario'

const esquema = z.object({
  nombre: z.string().trim().min(2, 'Ingresa el nombre completo'),
  email: z.string().trim().email('Ingresa un correo válido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
})

type FormValues = z.infer<typeof esquema>

export default function UsuariosPage() {
  const { data: roles, isLoading: cargandoRoles, isError: errorRoles } = useRoles()
  const crear = useCrearUsuario()
  const rolInventario = roles?.find((rol) => rol.nombre === ROL_OBJETIVO)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(esquema),
  })

  useEffect(() => {
    if (errorRoles) toast.error('No se pudo cargar el rol de encargado de inventario')
  }, [errorRoles])

  async function onSubmit(valores: FormValues) {
    if (!rolInventario) {
      toast.error('El rol de encargado de inventario no está disponible')
      return
    }

    try {
      await crear.mutateAsync({ ...valores, rol_id: rolInventario.id })
      toast.success('Usuario registrado correctamente')
      reset()
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'No se pudo registrar el usuario')
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">Administración de usuarios</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Registrar usuario</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Crea una cuenta con permisos para gestionar el inventario de StockIA.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="rounded-xl border bg-background p-6 shadow-sm">
        <div className="mb-6 flex items-start gap-3 border-b pb-5">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <UserPlus className="size-5" />
          </span>
          <div>
            <h2 className="font-semibold">Datos de acceso</h2>
            <p className="mt-1 text-sm text-muted-foreground">La cuenta quedará activa después de registrarla.</p>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="nombre">Nombre completo</Label>
            <Input id="nombre" placeholder="Ej. Ana García" {...register('nombre')} />
            {errors.nombre && <p className="text-xs text-destructive">{errors.nombre.message}</p>}
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input id="email" type="email" placeholder="nombre@empresa.com" {...register('email')} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="password">Contraseña temporal</Label>
            <Input id="password" type="password" placeholder="Mínimo 8 caracteres" {...register('password')} />
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>
        </div>

        <div className="mt-5 flex items-start gap-3 rounded-lg border border-dashed p-4">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
          <div className="text-sm">
            <p className="font-medium">Rol asignado</p>
            <p className="mt-1 text-muted-foreground">
              {cargandoRoles ? 'Cargando rol…' : rolInventario?.nombre ?? 'Rol no disponible'}
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button type="submit" disabled={crear.isPending || cargandoRoles || !rolInventario}>
            {crear.isPending ? 'Registrando…' : 'Registrar usuario'}
          </Button>
        </div>
      </form>
    </div>
  )
}
