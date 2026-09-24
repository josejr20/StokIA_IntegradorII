import { Bell, Search, LogOut } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/auth/AuthContext'

export function Topbar({ titulo }: { titulo: string }) {
  const { usuario, cerrarSesion } = useAuth()

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b bg-background px-6">
      <div className="min-w-0">
        <h1 className="truncate text-lg font-semibold">{titulo}</h1>
        <p className="truncate text-xs text-muted-foreground">
          Bienvenido, {usuario?.nombre ?? 'usuario'} · Su rol es: {usuario?.rol_nombre ?? usuario?.rol ?? 'sin rol'}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative hidden sm:block">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar producto…" className="w-64 pl-8" />
        </div>

        <Button variant="ghost" size="icon" aria-label="Notificaciones">
          <Bell className="size-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="grid size-8 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {usuario?.nombre?.[0]?.toUpperCase() ?? '?'}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{usuario?.nombre}</p>
              <p className="text-xs text-muted-foreground">{usuario?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={cerrarSesion}>
              <LogOut /> Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
