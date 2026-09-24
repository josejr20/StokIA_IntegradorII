import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'

import { ApiError } from '@/lib/api'
import { useAuth } from './AuthContext'

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: { client_id: string; callback: (response: { credential: string }) => void }) => void
          renderButton: (element: HTMLElement, options: { theme: string; size: string; width: number; text?: string }) => void
        }
      }
    }
  }
}

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

export function GoogleLoginButton({ mode = 'login' }: { mode?: 'login' | 'register' }) {
  const container = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const { loginWithGoogle, registerWithGoogle } = useAuth()

  useEffect(() => {
    if (!clientId || !container.current) return
    const render = () => {
      if (!window.google || !container.current) return false
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }) => {
          try {
            setError(null)
            if (mode === 'register') {
              await registerWithGoogle(credential)
              toast.success('Cuenta Google registrada. Ahora inicia sesión.')
              window.location.href = '/login'
            } else {
              await loginWithGoogle(credential)
              window.location.href = '/'
            }
          } catch (error) {
            const apiError = error instanceof ApiError ? error : null
            const code = apiError?.body && typeof apiError.body === 'object' ? (apiError.body as { code?: string }).code : undefined
            if (code === 'USER_NOT_REGISTERED') {
              setError('No tienes una cuenta registrada. Debes registrarte primero.')
            } else if (code === 'GOOGLE_ACCOUNT_EXISTS') {
              setError('Ya existe una cuenta con este correo. Inicia sesión desde la pantalla de acceso.')
            } else {
              toast.error(apiError?.message ?? 'No se pudo iniciar sesión con Google')
            }
          }
        },
      })
      window.google.accounts.id.renderButton(container.current, {
        theme: 'outline', size: 'large', width: 320,
        text: mode === 'register' ? 'signup_with' : 'continue_with',
      })
      return true
    }
    if (render()) return
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = render
    document.head.appendChild(script)
    return () => { script.onload = null }
  }, [loginWithGoogle, mode, registerWithGoogle])

  if (!clientId) {
    return (
      <button
        type="button"
        className="h-9 w-full rounded-md border border-input bg-background text-sm font-medium opacity-60"
        onClick={() => toast.error('Configura VITE_GOOGLE_CLIENT_ID para habilitar Google')}
      >
        Continuar con Google
      </button>
    )
  }
  return (
    <div>
      <div ref={container} className="min-h-10" />
      {error && (
        <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-center text-sm text-destructive">
          <p>{error}</p>
          <Link to={mode === 'login' ? '/registro' : '/login'} className="mt-1 inline-block font-medium underline">
            {mode === 'login' ? 'Ir a registrarse' : 'Ir a iniciar sesión'}
          </Link>
        </div>
      )}
    </div>
  )
}