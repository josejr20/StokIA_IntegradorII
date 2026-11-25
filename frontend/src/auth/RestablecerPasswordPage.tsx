import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError, api } from '@/lib/api'

const esquema = z.object({
  password: z.string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .regex(/\p{Lu}/u, 'Incluye al menos una letra mayúscula')
    .regex(/\p{Ll}/u, 'Incluye al menos una letra minúscula')
    .regex(/\p{N}/u, 'Incluye al menos un número')
    .regex(/[^\p{L}\p{N}\s]/u, 'Incluye al menos un carácter especial'),
  confirmacion: z.string().min(1, 'Confirma tu contraseña'),
}).refine((valores) => valores.password === valores.confirmacion, { message: 'Las contraseñas no coinciden', path: ['confirmacion'] })

export default function RestablecerPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') || ''
  const [enviando, setEnviando] = useState(false)
  const [mostrarPasswords, setMostrarPasswords] = useState({
    password: false,
    confirmacion: false,
  })
  const { register, handleSubmit, formState: { errors } } = useForm<{ password: string; confirmacion: string }>({ resolver: zodResolver(esquema) })

  function alternarVisibilidad(campo: keyof typeof mostrarPasswords) {
    setMostrarPasswords((actual) => ({ ...actual, [campo]: !actual[campo] }))
  }

  async function onSubmit({ password }: { password: string; confirmacion: string }) {
    setEnviando(true)
    try { await api.post('/auth/reset-password', { token, password }); toast.success('Contraseña actualizada correctamente'); navigate('/login') }
    catch (error) { toast.error(error instanceof ApiError ? error.message : 'No se pudo cambiar la contraseña') }
    finally { setEnviando(false) }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[#fdecec] p-8">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
        <Link to="/login" className="mb-5 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Volver al login
        </Link>
        <h1 className="text-xl font-semibold">Cambiar contraseña</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          El enlace es de un solo uso y válido durante 10 minutos. Ingresa una nueva contraseña con al menos 8 caracteres e incluyendo mayúscula, minúscula, número y carácter especial.
        </p>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password">Nueva contraseña</Label>
            <div className="relative">
              <Input id="password" type={mostrarPasswords.password ? 'text' : 'password'} autoComplete="new-password" className="pr-10" {...register('password')} />
              <button
                type="button"
                onClick={() => alternarVisibilidad('password')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                aria-label={mostrarPasswords.password ? 'Ocultar nueva contraseña' : 'Mostrar nueva contraseña'}
              >
                {mostrarPasswords.password ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirmacion">Confirmar nueva contraseña</Label>
            <div className="relative">
              <Input id="confirmacion" type={mostrarPasswords.confirmacion ? 'text' : 'password'} autoComplete="new-password" className="pr-10" {...register('confirmacion')} />
              <button
                type="button"
                onClick={() => alternarVisibilidad('confirmacion')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                aria-label={mostrarPasswords.confirmacion ? 'Ocultar confirmación de contraseña' : 'Mostrar confirmación de contraseña'}
              >
                {mostrarPasswords.confirmacion ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {errors.confirmacion && <p className="text-xs text-destructive">{errors.confirmacion.message}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={enviando || !token}>
            {enviando ? 'Actualizando…' : 'Cambiar contraseña'}
          </Button>
          {!token && <p role="alert" className="text-xs text-destructive">El enlace no es válido. Solicita uno nuevo.</p>}
        </form>
      </div>
    </div>
  )
}