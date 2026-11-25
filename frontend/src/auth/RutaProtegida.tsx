import { Navigate, Outlet } from 'react-router'
import type React from 'react'

import { useAuth, type PermisoCodigo } from './AuthContext'

export function RutaProtegida() {
  const { usuario, cargando } = useAuth()

  if (cargando) {
    return <div className="grid h-screen place-items-center text-muted-foreground">Cargando…</div>
  }
  if (!usuario) {
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}

export function RutaConPermiso({ permiso }: { permiso: PermisoCodigo }) {
  const { usuario, cargando, tienePermiso } = useAuth()

  if (cargando) {
    return <div className="grid h-screen place-items-center text-muted-foreground">Cargando…</div>
  }
  if (!usuario) return <Navigate to="/login" replace />
  if (!tienePermiso(permiso)) return <Navigate to="/" replace />
  return <Outlet />
}

export function RutaSoloAdministrador() {
  const { usuario, cargando } = useAuth()

  if (cargando) {
    return <div className="grid h-screen place-items-center text-muted-foreground">Cargando…</div>
  }
  if (!usuario) return <Navigate to="/login" replace />
  const rol = (usuario.rol_nombre ?? usuario.rol ?? '').trim().toLocaleLowerCase()
  if (rol !== 'administrador') return <Navigate to="/" replace />
  return <Outlet />
}

// HU-188: todos los roles ven el resumen de inicio al iniciar sesión; su contenido se adapta a los permisos.
export function RutaInicial({ children }: { children: React.ReactNode }) {
  const { usuario, cargando } = useAuth()

  if (cargando) {
    return <div className="grid h-screen place-items-center text-muted-foreground">Cargando…</div>
  }
  if (!usuario) return <Navigate to="/login" replace />
  return children
}