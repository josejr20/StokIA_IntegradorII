import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { UserPlus, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ApiError } from '@/lib/api'

import { useCrearUsuario, useRoles, useUsuarios } from './api'

const esquema = z.object({
  nombres: z.string().trim().min(2, 'Ingresa los nombres'),
  apellidos: z.string().trim().min(2, 'Ingresa los apellidos'),
  dni: z.string().trim().min(1, 'Ingresa el DNI'),
  email: z.string().trim().email('Ingresa un correo válido'),
  password: z
    .string()
    .min(8, 'Mínimo 8 caracteres')
    .regex(/[A-Z]/, 'Incluye al menos una mayúscula')
    .regex(/[a-z]/, 'Incluye al menos una minúscula')
    .regex(/[0-9]/, 'Incluye al menos un número')
    .regex(/[^A-Za-z0-9]/, 'Incluye al menos un símbolo'),
  rol_id: z.string().min(1, 'Selecciona un rol'),
  clave_secreta: z.string().min(1, 'Ingresa la clave secreta del servidor'),
})

type FormValues = z.infer<typeof esquema>

export default function UsuariosPage() {
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const { data: usuarios, isLoading: cargandoUsuarios, isError: errorUsuarios } = useUsuarios()
  const { data: roles, isLoading: cargandoRoles, isError: errorRoles } = useRoles()
  const crear = useCrearUsuario()
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(esquema),
  })

  useEffect(() => {
    if (errorRoles) toast.error('No se pudieron cargar los roles disponibles')
  }, [errorRoles])

  useEffect(() => {
    if (errorUsuarios) toast.error('No se pudieron cargar los usuarios')
  }, [errorUsuarios])

  async function onSubmit(valores: FormValues) {
    try {
      await crear.mutateAsync({ ...valores, rol_id: Number(valores.rol_id) })
      toast.success('Usuario registrado correctamente')
      reset()
      setMostrarFormulario(false)
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'No se pudo registrar el usuario')
    }
  }

  function formatearUltimoAcceso(fecha: string | null) {
    if (!fecha) return 'Sin acceso'
    const acceso = new Date(fecha)
    if (Number.isNaN(acceso.getTime())) return 'Sin acceso'

    const hoy = new Date()
    const ayer = new Date(hoy)
    ayer.setDate(hoy.getDate() - 1)
    const mismaFecha = (a: Date, b: Date) => a.toDateString() === b.toDateString()
    const dia = mismaFecha(acceso, hoy) ? 'Hoy' : mismaFecha(acceso, ayer) ? 'Ayer' : null
    const hora = new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit' }).format(acceso)
    if (dia) return `${dia}, ${hora}`
    const fechaCorta = new Intl.DateTimeFormat('es-PE').format(acceso)
    return `${fechaCorta}, ${hora}`
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-lg font-semibold tracking-tight">Usuarios del sistema</h1>
        <Button onClick={() => setMostrarFormulario(true)}>
          <UserPlus />
          Nuevo usuario
        </Button>
      </div>

      <Dialog open={mostrarFormulario} onOpenChange={(abierto) => {
        setMostrarFormulario(abierto)
        if (!abierto) reset()
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Registrar usuario</DialogTitle>
            <DialogDescription>Registra los datos del empleado y asigna su rol en StockIA.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="nombres">Nombres</Label>
            <Input id="nombres" placeholder="Ej. Dayana" {...register('nombres')} />
            {errors.nombres && <p className="text-xs text-destructive">{errors.nombres.message}</p>}
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="apellidos">Apellidos</Label>
            <Input id="apellidos" placeholder="Ej. García López" {...register('apellidos')} />
            {errors.apellidos && <p className="text-xs text-destructive">{errors.apellidos.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dni">DNI</Label>
            <Input id="dni" placeholder="Ej. 12345678" {...register('dni')} />
            {errors.dni && <p className="text-xs text-destructive">{errors.dni.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input id="email" type="email" placeholder="nombre@gmail.com" {...register('email')} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Contraseña temporal</Label>
            <Input id="password" type="password" placeholder="Mínimo 8, con mayúscula, minúscula, número y símbolo" {...register('password')} />
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rol_id">Rol del empleado</Label>
            <select
              id="rol_id"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              defaultValue=""
              {...register('rol_id')}
            >
              <option value="" disabled>{cargandoRoles ? 'Cargando roles…' : 'Selecciona un rol'}</option>
              {roles?.map((rol) => <option key={rol.id} value={rol.id}>{rol.nombre}</option>)}
            </select>
            {errors.rol_id && <p className="text-xs text-destructive">{errors.rol_id.message}</p>}
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="clave_secreta">Clave secreta de autorización</Label>
            <Input id="clave_secreta" type="password" autoComplete="off" placeholder="Clave secreta" {...register('clave_secreta')} />
            {errors.clave_secreta && <p className="text-xs text-destructive">{errors.clave_secreta.message}</p>}
          </div>
          </div>
            <div className="flex items-start gap-3 rounded-lg border border-dashed p-4">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="text-sm">
              <p className="font-medium">Rol asignado</p>
              <p className="mt-1 text-muted-foreground">
                {cargandoRoles ? 'Cargando roles…' : `${roles?.length ?? 0} roles disponibles`}
              </p>
            </div>
          </div>

          <DialogFooter className="mt-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => {
              setMostrarFormulario(false)
              reset()
            }}>
              Cancelar
            </Button>
            <Button type="submit" disabled={crear.isPending || cargandoRoles || !roles?.length}>
              {crear.isPending ? 'Registrando…' : 'Registrar usuario'}
            </Button>
          </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="overflow-hidden rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
               <TableHead>Nombre</TableHead>
               <TableHead>DNI</TableHead>
               <TableHead>Correo</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Último acceso</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cargandoUsuarios && <TableRow><TableCell colSpan={5} className="h-20 text-center text-muted-foreground">Cargando usuarios…</TableCell></TableRow>}
            {errorUsuarios && <TableRow><TableCell colSpan={5} className="h-20 text-center text-destructive">No se pudo cargar la lista de usuarios.</TableCell></TableRow>}
            {!cargandoUsuarios && !errorUsuarios && usuarios?.length === 0 && <TableRow><TableCell colSpan={5} className="h-20 text-center text-muted-foreground">No hay usuarios registrados.</TableCell></TableRow>}
            {!cargandoUsuarios && !errorUsuarios && usuarios?.map((usuario) => (
               <TableRow key={usuario.id}>
                 <TableCell className="font-medium">{usuario.nombres} {usuario.apellidos}</TableCell>
                 <TableCell>{usuario.dni}</TableCell>
                 <TableCell>{usuario.email}</TableCell>
                <TableCell>{usuario.rol || 'Sin rol'}</TableCell>
                <TableCell>
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${usuario.activo ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'}`}>
                    {usuario.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{formatearUltimoAcceso(usuario.ultimo_acceso)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
