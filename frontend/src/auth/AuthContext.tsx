import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

import { api, clearTokens, getAccessToken, setTokens } from '@/lib/api'
import type { Usuario } from '@/types'

interface AuthState {
  usuario: Usuario | null
  cargando: boolean
  iniciarSesion: (email: string, password: string) => Promise<void>
  cerrarSesion: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [cargando, setCargando] = useState(true)

  async function cargarUsuario() {
    try {
      const datos = await api.get<Usuario>('/usuarios/yo/')
      setUsuario(datos)
    } catch {
      setUsuario(null)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    if (getAccessToken()) {
      cargarUsuario()
    } else {
      setCargando(false)
    }
  }, [])

  async function iniciarSesion(email: string, password: string) {
    const datos = await api.post<{ access: string; refresh: string }>('/auth/login/', { email, password })
    setTokens(datos.access, datos.refresh)
    await cargarUsuario()
  }

  function cerrarSesion() {
    clearTokens()
    setUsuario(null)
  }

  return (
    <AuthContext.Provider value={{ usuario, cargando, iniciarSesion, cerrarSesion }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const contexto = useContext(AuthContext)
  if (!contexto) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return contexto
}
