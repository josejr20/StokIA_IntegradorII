import { NavLink } from 'react-router'
import {
  BarChart3, Home, LayoutDashboard, Package, Boxes, ShoppingCart,
  TrendingUp, Brain, Settings, Users, ScrollText,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { useAuth } from '@/auth/AuthContext'

// Coincide 1 a 1 con las 11 pantallas del prototipo de Figma (ProyectoHU).
const NAV = [
  { to: '/', label: 'Inicio', icon: Home, fin: true },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/productos', label: 'Productos', icon: Package },
  { to: '/inventario', label: 'Lotes e inventario', icon: Boxes },
  { to: '/ventas', label: 'Ventas', icon: ShoppingCart },
  { to: '/prediccion', label: 'Predicción y riesgo', icon: TrendingUp },
  { to: '/modelo-ml', label: 'Modelo ML', icon: Brain },
  { to: '/configuracion', label: 'Configuración', icon: Settings },
  { to: '/usuarios', label: 'Usuarios', icon: Users },
  { to: '/auditoria', label: 'Auditoría', icon: ScrollText },
]

export function Sidebar() {
  const { usuario } = useAuth()

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 px-5 py-5">
        <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
          <BarChart3 className="size-4" />
        </span>
        <span className="text-base font-semibold">StockIA</span>
      </div>

      <nav className="flex-1 space-y-0.5 px-3">
        {NAV.map(({ to, label, icon: Icon, fin }) => (
          <NavLink
            key={to}
            to={to}
            end={fin}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                  : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
              )
            }
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="flex items-center gap-3 border-t border-sidebar-border px-5 py-4">
        <span className="grid size-8 place-items-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
          {usuario?.nombre?.[0]?.toUpperCase() ?? '?'}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{usuario?.nombre}</p>
          <p className="truncate text-xs text-sidebar-foreground/60">{usuario?.rol_nombre}</p>
        </div>
      </div>
    </aside>
  )
}
