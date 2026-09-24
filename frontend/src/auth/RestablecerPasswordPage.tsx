import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError, api } from '@/lib/api'

const esquema = z.object({ password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'), confirmacion: z.string().min(1, 'Confirma tu contraseña') }).refine((valores) => valores.password === valores.confirmacion, { message: 'Las contraseñas no coinciden', path: ['confirmacion'] })

export default function RestablecerPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const email = params.get('email') || ''
  const code = params.get('code') || ''
  const [enviando, setEnviando] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm<{ password: string; confirmacion: string }>({ resolver: zodResolver(esquema) })

  async function onSubmit({ password }: { password: string; confirmacion: string }) {
    setEnviando(true)
    try { await api.post('/auth/reset-password', { email, code, password }); toast.success('Contraseña actualizada correctamente'); navigate('/login') }
    catch (error) { toast.error(error instanceof ApiError ? error.message : 'No se pudo cambiar la contraseña') }
    finally { setEnviando(false) }
  }

  return <div className="grid min-h-screen place-items-center bg-[#fdecec] p-8"><div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm"><Link to="/login" className="mb-5 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Volver al login</Link><h1 className="text-xl font-semibold">Nueva contraseña</h1><p className="mt-1 text-sm text-muted-foreground">Elige una contraseña segura para tu cuenta.</p><form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4"><div className="space-y-1.5"><Label htmlFor="password">Nueva contraseña</Label><Input id="password" type="password" {...register('password')} />{errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}</div><div className="space-y-1.5"><Label htmlFor="confirmacion">Confirmar contraseña</Label><Input id="confirmacion" type="password" {...register('confirmacion')} />{errors.confirmacion && <p className="text-xs text-destructive">{errors.confirmacion.message}</p>}</div><Button type="submit" className="w-full" disabled={enviando}>{enviando ? 'Actualizando…' : 'Cambiar contraseña'}</Button></form></div></div>
}