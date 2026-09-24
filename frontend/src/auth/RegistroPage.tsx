import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router'
import { ArrowLeft, BarChart3, UserPlus } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError, api } from '@/lib/api'
import { GoogleLoginButton } from './GoogleLoginButton'

const esquema = z.object({
  nombre: z.string().trim().min(2, 'Ingresa el nombre completo'),
  email: z.string().trim().email('Ingresa un correo válido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  confirmacion: z.string().min(1, 'Confirma tu contraseña'),
}).refine((valores) => valores.password === valores.confirmacion, {
  message: 'Las contraseñas no coinciden', path: ['confirmacion'],
})

type FormValues = z.infer<typeof esquema>

export default function RegistroPage() {
  const navigate = useNavigate()
  const [enviando, setEnviando] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(esquema),
  })

  async function onSubmit(valores: FormValues) {
    setEnviando(true)
    try {
      await api.post('/auth/registro', valores)
      toast.success('Usuario registrado correctamente')
      navigate('/login')
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'No se pudo registrar el usuario')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex items-center justify-center bg-[#fdecec] p-8">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
          <div className="mb-6 flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <BarChart3 className="size-4" />
            </span>
            <span className="text-lg font-semibold">StockIA</span>
          </div>

          <Link to="/login" className="mb-5 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Volver al inicio de sesión
          </Link>
          <h1 className="text-xl font-semibold">Registrar nuevo usuario</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Crea tu cuenta con el rol de encargado de inventario.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="nombre">Nombre completo</Label>
              <Input id="nombre" autoComplete="name" placeholder="Ej. Jose" {...register('nombre')} />
              {errors.nombre && <p className="text-xs text-destructive">{errors.nombre.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input id="email" type="email" autoComplete="email" placeholder="nombre@empresa.com" {...register('email')} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" type="password" autoComplete="new-password" placeholder="Mínimo 8 caracteres" {...register('password')} />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmacion">Confirmar contraseña</Label>
              <Input id="confirmacion" type="password" autoComplete="new-password" placeholder="Repite tu contraseña" {...register('confirmacion')} />
              {errors.confirmacion && <p className="text-xs text-destructive">{errors.confirmacion.message}</p>}
            </div>

            <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <UserPlus className="size-4 text-primary" /> Rol: Encargado de Inventario
              </div>
              <p className="mt-1">El rol se asigna automáticamente durante el registro.</p>
            </div>

            <Button type="submit" className="w-full" disabled={enviando}>
              {enviando ? 'Registrando…' : 'Registrar usuario'}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> o <span className="h-px flex-1 bg-border" />
          </div>
          <p className="mb-2 text-center text-sm font-medium">Registrarse con Google</p>
          <GoogleLoginButton mode="register" />
        </div>
      </div>

      <div className="relative hidden overflow-hidden bg-gradient-to-br from-primary to-red-800 lg:block">
        <div className="relative z-10 flex h-full flex-col justify-center px-16 text-white">
          <BarChart3 className="mb-4 size-8" />
          <p className="text-lg font-bold tracking-wide">VLAG</p>
          <p className="text-xs tracking-[0.2em] text-white/80">100% NATURAL</p>
          <h2 className="mt-4 text-3xl font-bold">Gestión predictiva de inventarios</h2>
          <p className="mt-2 max-w-sm text-white/85">
            Predicción de demanda, riesgo de vencimiento y recomendaciones con Machine Learning.
          </p>
        </div>
      </div>
    </div>
  )
}