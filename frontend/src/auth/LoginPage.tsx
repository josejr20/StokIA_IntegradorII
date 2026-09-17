import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router'
import { BarChart3 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError } from '@/lib/api'
import { useAuth } from './AuthContext'

// HU12: inicio de sesión
const esquema = z.object({
  email: z.string().email('Ingresa un correo válido'),
  password: z.string().min(1, 'Ingresa tu contraseña'),
})
type FormValues = z.infer<typeof esquema>

export default function LoginPage() {
  const { iniciarSesion } = useAuth()
  const navigate = useNavigate()
  const [enviando, setEnviando] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(esquema) })

  async function onSubmit(valores: FormValues) {
    setEnviando(true)
    try {
      await iniciarSesion(valores.email, valores.password)
      navigate('/', { replace: true })
    } catch (error) {
      const mensaje = error instanceof ApiError ? error.message : 'No se pudo iniciar sesión'
      toast.error(mensaje)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Panel de formulario */}
      <div className="flex items-center justify-center bg-[#fdecec] p-8">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
          <div className="mb-6 flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <BarChart3 className="size-4" />
            </span>
            <span className="text-lg font-semibold">StockIA</span>
          </div>

          <h1 className="text-xl font-semibold">Bienvenido de nuevo</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ingresa tus credenciales para acceder al sistema.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Correo institucional</Label>
              <Input id="email" type="email" placeholder="nombre@empresa.com" {...register('email')} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" type="password" placeholder="••••••••" {...register('password')} />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>

            <div className="text-right text-sm">
              {/* HU38 */}
              <a href="/recuperar" className="text-primary hover:underline">
                ¿Olvidaste tu contraseña?
              </a>
            </div>

            <Button type="submit" className="w-full" disabled={enviando}>
              {enviando ? 'Ingresando…' : 'Iniciar sesión'}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Roles disponibles: Administrador · Encargado de inventario · Encargado de almacén · Jefe de ventas
          </p>
        </div>
      </div>

      {/* Panel de marca */}
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
