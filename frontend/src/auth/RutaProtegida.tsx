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

export function RutaInicial({ children }: { children: React.ReactNode }) {
  const { usuario, cargando, tienePermiso } = useAuth()

  if (cargando) {
    return <div className="grid h-screen place-items-center text-muted-foreground">Cargando…</div>
  }
  if (!usuario) return <Navigate to="/login" replace />
  if (tienePermiso('generar_reportes')) return children
  if (tienePermiso('ver_kpis')) return <Navigate to="/dashboard" replace />
  if (tienePermiso('gestionar_productos')) return <Navigate to="/productos" replace />
  if (tienePermiso('gestionar_inventario')) return <Navigate to="/inventario" replace />
  if (tienePermiso('gestionar_ventas')) return <Navigate to="/ventas" replace />
  return <div className="p-6 text-muted-foreground">Tu usuario no tiene pantallas asignadas.</div>
}
