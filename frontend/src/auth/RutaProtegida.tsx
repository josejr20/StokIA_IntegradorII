import { Navigate, Outlet } from 'react-router'

import { useAuth } from './AuthContext'

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
