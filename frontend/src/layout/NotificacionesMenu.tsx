import { useState } from 'react'
import { Bell, Loader2 } from 'lucide-react'

import { api } from '@/lib/api'
import { useAuth } from '@/auth/AuthContext'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
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

    async function cargarAlertas() {
        if (!autorizado) return

        setCargando(true)
        setError('')

        try {
            const respuesta = await api.get<{ data: Alerta[] }>(
                '/alertas?tipo=bajo_stock'
            )

            setAlertas(
                respuesta.data.filter(
                    (alerta) =>
                        alerta.estado === 'nueva' ||
                        alerta.estado === 'vista'
                )
            )
        } catch {
            setError('No se pudieron cargar las notificaciones.')
        } finally {
            setCargando(false)
        }
    }

    if (!autorizado) return null

    return (
        <DropdownMenu onOpenChange={(abierto) => {
            if (abierto) void cargarAlertas()
        }}>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Notificaciones"
                >
                    <Bell className="size-4" />
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
                align="end"
                className="w-80 max-w-[calc(100vw-2rem)]"
            >
                <div className="border-b px-3 py-2">
                    <p className="text-sm font-semibold">
                        Alertas de inventario
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Notificaciones de bajo stock
                    </p>
                </div>

                <div className="max-h-80 overflow-y-auto">
                    {cargando ? (
                        <div className="flex items-center gap-2 p-4 text-sm">
                            <Loader2 className="size-4 animate-spin" />
                            Cargando notificaciones...
                        </div>
                    ) : error ? (
                        <p className="p-4 text-sm text-destructive">
                            {error}
                        </p>
                    ) : alertas.length === 0 ? (
                        <p className="p-4 text-sm text-muted-foreground">
                            No hay notificaciones pendientes.
                        </p>
                    ) : (
                        alertas.map((alerta) => (
                            <div
                                key={alerta.id}
                                className="border-b px-3 py-3 last:border-b-0"
                            >
                                <p className="text-xs font-medium">
                                    Producto #{alerta.producto_id}
                                </p>
                                <p className="mt-1 text-sm">
                                    {alerta.mensaje}
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