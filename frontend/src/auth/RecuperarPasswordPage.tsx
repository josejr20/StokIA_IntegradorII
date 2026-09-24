import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router'
import { ArrowLeft, BarChart3, Mail } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError, api } from '@/lib/api'

const esquema = z.object({ email: z.string().email('Ingresa un correo válido') })
type FormValues = z.infer<typeof esquema>

export default function RecuperarPasswordPage() {
  const navigate = useNavigate()
  const [enviando, setEnviando] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(esquema) })

  async function onSubmit({ email }: FormValues) {
    setEnviando(true)
    try {
      await api.post('/auth/forgot-password', { email })
      toast.success('Si el correo está registrado, recibirás un código')
      navigate(`/verificar-codigo?email=${encodeURIComponent(email)}`)
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'No se pudo solicitar el código')
    } finally { setEnviando(false) }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[#fdecec] p-8">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
        <Link to="/login" className="mb-5 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Volver</Link>
        <div className="mb-5 flex items-center gap-2"><span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground"><BarChart3 className="size-4" /></span><span className="text-lg font-semibold">StockIA</span></div>
        <h1 className="text-xl font-semibold">Recuperar contraseña</h1>
        <p className="mt-1 text-sm text-muted-foreground">Te enviaremos un código de 6 dígitos a tu correo.</p>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <div className="space-y-1.5"><Label htmlFor="email">Correo electrónico</Label><Input id="email" type="email" placeholder="nombre@empresa.com" {...register('email')} />{errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}</div>
          <Button type="submit" className="w-full" disabled={enviando}><Mail className="size-4" />{enviando ? 'Enviando…' : 'Enviar código'}</Button>
        </form>
      </div>
    </div>
  )
}
