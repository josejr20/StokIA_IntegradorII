import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Bell, Loader2 } from 'lucide-react'

import { api } from '@/lib/api'
import { useAuth } from '@/auth/AuthContext'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Alerta {
  id: number
  tipo: string
  producto_id: number
  mensaje: string
  severidad: string
  estado: string
  fecha_creacion: string
}

export function NotificacionesMenu() {
  const { tienePermiso } = useAuth()
  const autorizado = tienePermiso('ver_alertas')
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  const cargarAlertas = useCallback(
    async (mostrarCarga = false) => {
      if (!autorizado) return

      if (mostrarCarga) setCargando(true)

      try {
        const respuesta = await api.get<{ data: Alerta[] }>('/alertas')
        const pendientes = respuesta.data.filter(
          (alerta) =>
            (alerta.tipo === 'bajo_stock' || alerta.tipo === 'anomalia') &&
            (alerta.estado === 'nueva' || alerta.estado === 'vista'),
        )

        setAlertas(pendientes)
        setError('')
      } catch {
        setError('No se pudieron cargar las notificaciones.')
      } finally {
        if (mostrarCarga) setCargando(false)
      }
    },
    [autorizado],
  )

  useEffect(() => {
    if (!autorizado) return

    void cargarAlertas()
    const intervalo = window.setInterval(() => void cargarAlertas(), 30000)
    const actualizarNotificaciones = () => void cargarAlertas()
    window.addEventListener(
      'reabastecimiento:orden_generada',
      actualizarNotificaciones,
    )

    return () => {
      window.clearInterval(intervalo)
      window.removeEventListener(
        'reabastecimiento:orden_generada',
        actualizarNotificaciones,
      )
    }
  }, [autorizado, cargarAlertas])

  if (!autorizado) return null

  const total = alertas.length

  return (
    <DropdownMenu
      onOpenChange={(abierto) => {
        if (abierto) void cargarAlertas(true)
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Notificaciones"
        >
          <Bell className="size-4" />
          {total > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
              {total > 99 ? '99+' : total}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-80 max-w-[calc(100vw-2rem)]"
      >
        <div className="border-b px-3 py-2">
          <p className="text-sm font-semibold">Alertas de inventario</p>
          <p className="text-xs text-muted-foreground">
            Bajo stock y anomalías detectadas
          </p>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {cargando ? (
            <div className="flex items-center gap-2 p-4 text-sm">
              <Loader2 className="size-4 animate-spin" />
              Cargando notificaciones...
            </div>
          ) : error ? (
            <p className="p-4 text-sm text-destructive">{error}</p>
          ) : total === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              No hay notificaciones pendientes.
            </p>
          ) : (
            alertas.map((alerta) => (
              <div
                key={alerta.id}
                className="border-b px-3 py-3 last:border-b-0"
              >
                <div className="flex items-center gap-2">
                  {alerta.tipo === 'anomalia' && (
                    <AlertTriangle className="size-4 text-amber-600" />
                  )}
                  <p className="text-xs font-semibold">
                    {alerta.tipo === 'anomalia'
                      ? 'Anomalía detectada'
                      : 'Bajo stock'}
                  </p>
                </div>

                <p className="mt-1 text-xs font-medium">
                  Producto #{alerta.producto_id}
                </p>
                <p className="mt-1 text-sm">{alerta.mensaje}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Severidad: {alerta.severidad}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(alerta.fecha_creacion).toLocaleString('es-PE')}
                </p>
              </div>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
