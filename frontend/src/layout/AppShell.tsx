import { Outlet, useLocation } from 'react-router'

import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

// El título del topbar sale de la misma ruta activa, así ninguna página
// tiene que repetirlo a mano.
const TITULOS: Record<string, string> = {
  '/': 'Inicio',
  '/dashboard': 'Dashboard',
  '/productos': 'Productos',
  '/inventario': 'Lotes e inventario',
  '/kardex': 'Kardex',
  '/ventas': 'Ventas',
  '/prediccion': 'Predicción y riesgo',
  '/modelo-ml': 'Modelo ML',
  '/configuracion': 'Configuración',
  '/usuarios': 'Usuarios',
  '/auditoria': 'Auditoría',
}

export function AppShell() {
  const { pathname } = useLocation()
  const titulo = TITULOS[pathname] ?? 'StockIA'

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar titulo={titulo} />
        <main className="flex-1 overflow-y-auto bg-muted/30 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
