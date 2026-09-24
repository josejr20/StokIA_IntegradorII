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

const esquema = z.object({ code: z.string().regex(/^\d{6}$/, 'Ingresa un código de 6 dígitos') })

export default function VerificarCodigoPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const email = params.get('email') || ''
  const [enviando, setEnviando] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm<{ code: string }>({ resolver: zodResolver(esquema) })

  async function verificar({ code }: { code: string }) {
    setEnviando(true)
    try { await api.post('/auth/verify-reset-code', { email, code }); navigate(`/restablecer?email=${encodeURIComponent(email)}&code=${code}`) }
    catch (error) { toast.error(error instanceof ApiError ? error.message : 'No se pudo verificar el código') }
    finally { setEnviando(false) }
  }

  async function reenviar() {
    try { await api.post('/auth/forgot-password', { email }); toast.success('Código reenviado') }
    catch { toast.error('No se pudo reenviar el código') }
  }

  return <div className="grid min-h-screen place-items-center bg-[#fdecec] p-8"><div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm"><Link to="/login" className="mb-5 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Volver al login</Link><h1 className="text-xl font-semibold">Verificar código</h1><p className="mt-1 text-sm text-muted-foreground">Revisa tu correo e ingresa el código recibido.</p><form onSubmit={handleSubmit(verificar)} className="mt-6 space-y-4"><div className="space-y-1.5"><Label htmlFor="code">Código de recuperación</Label><Input id="code" inputMode="numeric" maxLength={6} placeholder="000000" {...register('code')} />{errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}</div><Button type="submit" className="w-full" disabled={enviando}>{enviando ? 'Verificando…' : 'Verificar código'}</Button></form><button type="button" className="mt-4 w-full text-sm text-primary hover:underline" onClick={reenviar}>Reenviar código</button></div></div>
}