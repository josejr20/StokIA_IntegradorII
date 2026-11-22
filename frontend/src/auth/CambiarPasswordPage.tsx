import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Eye, EyeOff, KeyRound } from 'lucide-react'
import { Link } from 'react-router'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError, api } from '@/lib/api'

const esquema = z.object({
  currentPassword: z.string().min(1, 'Ingresa tu contraseña actual'),
  newPassword: z.string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .regex(/\p{Lu}/u, 'Incluye al menos una letra mayúscula')
    .regex(/\p{Ll}/u, 'Incluye al menos una letra minúscula')
    .regex(/\p{N}/u, 'Incluye al menos un número')
    .regex(/[^\p{L}\p{N}\s]/u, 'Incluye al menos un carácter especial'),
  confirmacion: z.string().min(1, 'Confirma tu contraseña'),
}).refine((valores) => valores.newPassword !== valores.currentPassword, {
  message: 'La nueva contraseña debe ser diferente a la contraseña actual',
  path: ['newPassword'],
}).refine((valores) => valores.newPassword === valores.confirmacion, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmacion'],
})

type FormValues = z.infer<typeof esquema>

export default function CambiarPasswordPage() {
  const [enviando, setEnviando] = useState(false)
  const [mostrarPasswords, setMostrarPasswords] = useState({
    currentPassword: false,
    newPassword: false,
    confirmacion: false,
  })
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(esquema),
  })

  function alternarVisibilidad(campo: keyof typeof mostrarPasswords) {
    setMostrarPasswords((actual) => ({ ...actual, [campo]: !actual[campo] }))
  }

  async function onSubmit({ currentPassword, newPassword }: FormValues) {
    setEnviando(true)
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword })
      reset()
      toast.success('Contraseña actualizada correctamente')
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'No se pudo cambiar la contraseña')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg rounded-2xl bg-white p-8 shadow-sm">
      <Link to="/" className="mb-5 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Volver
      </Link>
      <div className="mb-4 flex items-center gap-2">
        <KeyRound className="size-5 text-primary" />
        <h2 className="text-xl font-semibold">Cambiar contraseña</h2>
      </div>
      <p className="text-sm text-muted-foreground">Confirma tu contraseña actual y elige una diferente.</p>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="currentPassword">Contraseña actual</Label>
          <div className="relative">
            <Input id="currentPassword" type={mostrarPasswords.currentPassword ? 'text' : 'password'} autoComplete="current-password" className="pr-10" {...register('currentPassword')} />
            <button
              type="button"
              onClick={() => alternarVisibilidad('currentPassword')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={mostrarPasswords.currentPassword ? 'Ocultar contraseña actual' : 'Mostrar contraseña actual'}
            >
              {mostrarPasswords.currentPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {errors.currentPassword && <p className="text-xs text-destructive">{errors.currentPassword.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="newPassword">Nueva contraseña</Label>
          <div className="relative">
            <Input id="newPassword" type={mostrarPasswords.newPassword ? 'text' : 'password'} autoComplete="new-password" className="pr-10" {...register('newPassword')} />
            <button
              type="button"
              onClick={() => alternarVisibilidad('newPassword')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={mostrarPasswords.newPassword ? 'Ocultar nueva contraseña' : 'Mostrar nueva contraseña'}
            >
              {mostrarPasswords.newPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {errors.newPassword && <p className="text-xs text-destructive">{errors.newPassword.message}</p>}
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
        <Button type="submit" className="w-full" disabled={enviando}>
          {enviando ? 'Actualizando…' : 'Cambiar contraseña'}
        </Button>
      </form>
    </div>
  )
}
