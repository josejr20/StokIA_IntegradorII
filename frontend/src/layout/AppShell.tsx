import { Outlet, useLocation } from 'react-router'

import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { useInventarioRealtime } from '@/lib/socket'

// El título del topbar sale de la misma ruta activa, así ninguna página
// tiene que repetirlo a mano.
const TITULOS: Record<string, string> = {
  '/': 'Inicio',
  '/dashboard': 'Dashboard',
  '/productos': 'Productos',
  '/inventario': 'Lotes e inventario',
  '/kardex': 'Kardex',
  '/ventas': 'Ventas',
<<<<<<< HEAD
  '/prediccion': 'Predicción y riesgo',
  '/riesgo-vencimiento': 'Riesgo de vencimiento',
=======
  '/operaciones': 'Operaciones',
  '/comprobantes': 'Comprobantes',
  '/clientes': 'Clientes',
  '/prediccion': 'PredicciÃ³n y riesgo',
>>>>>>> 4d80470 (Websocket-Comrobante)
  '/modelo-ml': 'Modelo ML',
  '/configuracion': 'ConfiguraciÃ³n',
  '/usuarios': 'Usuarios',
  '/auditoria': 'AuditorÃ­a',
}

export function AppShell() {
  useInventarioRealtime()
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
