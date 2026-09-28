import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

import { api } from '@/lib/api'
export type PermisoCodigo =
  | 'gestionar_productos'
  | 'gestionar_inventario'
  | 'gestionar_ventas'
  | 'configurar_umbrales'
  | 'gestionar_reabastecimiento'
  | 'ver_alertas'
  | 'generar_reportes'
  | 'ver_kpis'
  | 'gestionar_usuarios'
  | 'gestionar_roles'
  | 'ver_auditoria'

export interface Usuario {
  id: number
  nombres: string
  apellidos: string
  dni: string
  email: string
  rol_id: number | null
  rol_nombre?: string | null
  rol?: string | null
  permisos: PermisoCodigo[]
  is_staff?: boolean
  activo: boolean
}

interface AuthState {
  usuario: Usuario | null
  cargando: boolean
  isAuthenticated: boolean
  iniciarSesion: (identifier: string, password: string) => Promise<void>
  refreshUser: () => Promise<void>
  cerrarSesion: () => Promise<void>
  tienePermiso: (permiso: PermisoCodigo) => boolean
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [cargando, setCargando] = useState(true)
  const cargaInicial = useRef(false)

  async function cargarUsuario() {
    try {
      const datos = await api.get<{ data: Usuario }>('/auth/me')
      setUsuario(datos.data)
    } catch {
      setUsuario(null)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    if (cargaInicial.current) return
    cargaInicial.current = true
    cargarUsuario()
  }, [])

  async function iniciarSesion(identifier: string, password: string) {
    await api.post<{ usuario: Usuario }>(
      '/auth/login',
      { identifier, password },
    )
    await cargarUsuario()
  }

  async function cerrarSesion() {
    await api.post('/auth/logout')
    setUsuario(null)
  }

  function tienePermiso(permiso: PermisoCodigo) {
    return Boolean(usuario?.is_staff || usuario?.permisos?.includes(permiso))
  }

  return (
    <AuthContext.Provider value={{
      usuario,
      cargando,
      isAuthenticated: Boolean(usuario),
      iniciarSesion,
      refreshUser: cargarUsuario,
      cerrarSesion,
      tienePermiso,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const contexto = useContext(AuthContext)
  if (!contexto) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return contexto
}