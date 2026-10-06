import { useEffect, useState } from 'react'
import { Pencil, Plus, Search, UserRound, UserX } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { ApiError } from '@/lib/api'
import {
  useActualizarCliente,
  useCrearCliente,
  useHistorialCliente,
  useClientes,
} from '@/features/operaciones/api'
import type { Cliente } from '@/types'

interface EdicionCliente {
  id: number | null // null = nuevo
  nombre: string
  documento: string
}

const VACIO: EdicionCliente = { id: null, nombre: '', documento: '' }

export default function ClientesPage() {
  const [buscar, setBuscar] = useState('')
  const [debounce, setDebounce] = useState('')
  const [edicion, setEdicion] = useState<EdicionCliente | null>(null)
  const [detalleId, setDetalleId] = useState<number | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebounce(buscar), 250)
    return () => clearTimeout(t)
  }, [buscar])

  const { data: clientes, isLoading } = useClientes(debounce)
  const crearCliente = useCrearCliente()
  const actualizarCliente = useActualizarCliente()
  const { data: historial } = useHistorialCliente(detalleId)

  const detalle = clientes?.find((c) => c.id === detalleId) ?? null

  async function guardar() {
    if (!edicion) return
    if (!edicion.nombre.trim()) {
      toast.error('El nombre del cliente es obligatorio')
      return
    }
    try {
      if (edicion.id === null) {
        await crearCliente.mutateAsync({
          nombre: edicion.nombre.trim(),
          documento: edicion.documento.trim() || null,
        })
        toast.success('Cliente registrado')
      } else {
        await actualizarCliente.mutateAsync({
          id: edicion.id,
          datos: {
            nombre: edicion.nombre.trim(),
            documento: edicion.documento.trim() || null,
          },
        })
        toast.success('Cliente actualizado')
      }
      setEdicion(null)
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'No se pudo guardar el cliente')
    }
  }

  async function toggleActivo(cliente: Cliente) {
    try {
      await actualizarCliente.mutateAsync({
        id: cliente.id,
        datos: { nombre: cliente.nombre, documento: cliente.documento, activo: !cliente.activo },
      })
      toast.success(cliente.activo ? 'Cliente desactivado' : 'Cliente reactivado')
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'No se pudo actualizar el estado')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Clientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Los clientes se asocian a cada venta, devolución y ajuste relacionado.
          </p>
        </div>
        <Button onClick={() => setEdicion(VACIO)}>
          <Plus className="size-4" />
          Nuevo cliente
        </Button>
      </div>

      <div className="max-w-sm">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nombre o documento..."
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-muted-foreground">
              <th className="p-4">Nombre</th>
              <th className="p-4">Documento</th>
              <th className="p-4">Estado</th>
              <th className="p-4">Fecha de alta</th>
              <th className="p-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && (
              <tr><td className="p-4 text-muted-foreground" colSpan={5}>Cargando clientes...</td></tr>
            )}
            {!isLoading && clientes?.map((cliente) => (
              <tr key={cliente.id}>
                <td className="p-4">
                  <button
                    type="button"
                    onClick={() => setDetalleId(cliente.id)}
                    className="cursor-pointer font-medium hover:underline"
                  >
                    {cliente.nombre}
                  </button>
                </td>
                <td className="p-4">{cliente.documento ?? '—'}</td>
                <td className="p-4">
                  {cliente.activo ? (
                    <span className="rounded-full bg-secondary/15 px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                      Activo
                    </span>
                  ) : (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      Inactivo
                    </span>
                  )}
                </td>
                <td className="p-4">{new Date(cliente.fecha_creacion).toLocaleDateString('es-PE')}</td>
                <td className="p-4">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEdicion({ id: cliente.id, nombre: cliente.nombre, documento: cliente.documento ?? '' })}
                    >
                      <Pencil className="size-4" />
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleActivo(cliente)}
                      title={cliente.activo ? 'Desactivar' : 'Reactivar'}
                    >
                      {cliente.activo ? (
                        <UserX className="size-4" />
                      ) : (
                        <UserRound className="size-4" />
                      )}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && clientes && clientes.length === 0 && (
              <tr>
                <td className="p-4 text-center text-muted-foreground" colSpan={5}>
                  No hay clientes que coincidan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Crear / editar */}
      <Dialog open={edicion !== null} onOpenChange={(abierto) => !abierto && setEdicion(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{edicion?.id === null ? 'Nuevo cliente' : 'Editar cliente'}</DialogTitle>
          </DialogHeader>
          {edicion && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>
                  Nombre <span className="text-destructive">*</span>
                </Label>
                <Input
                  autoFocus
                  value={edicion.nombre}
                  onChange={(e) => setEdicion({ ...edicion, nombre: e.target.value })}
                  placeholder="Nombre completo o razón social"
                />
              </div>
              <div className="space-y-2">
                <Label>Documento</Label>
                <Input
                  value={edicion.documento}
                  onChange={(e) => setEdicion({ ...edicion, documento: e.target.value })}
                  placeholder="RUC / DNI (opcional)"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdicion(null)}>Cancelar</Button>
            <Button onClick={guardar} disabled={crearCliente.isPending || actualizarCliente.isPending}>
              {crearCliente.isPending || actualizarCliente.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Historial del cliente */}
      <Sheet open={detalleId !== null} onOpenChange={(abierto) => !abierto && setDetalleId(null)}>
        <SheetContent className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{detalle?.nombre ?? 'Cliente'}</SheetTitle>
          </SheetHeader>
          {detalle && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Documento</p>
                  <p>{detalle.documento ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Estado</p>
                  <p className={cn(detalle.activo ? 'text-secondary' : 'text-muted-foreground')}>
                    {detalle.activo ? 'Activo' : 'Inactivo'}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold">
                  Historial de operaciones ({historial?.length ?? 0})
                </h3>
                {historial && historial.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Este cliente aún no tiene operaciones.
                  </p>
                )}
                <div className="space-y-2">
                  {historial?.map((operacion) => (
                    <div
                      key={operacion.id}
                      className="flex items-center justify-between rounded-md border p-3 text-sm"
                    >
                      <div>
                        <p className="font-mono font-medium">{operacion.numero}</p>
                        <p className="text-xs text-muted-foreground">
                          {operacion.tipo} · {new Date(operacion.fecha).toLocaleString('es-PE')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">S/ {operacion.total.toFixed(2)}</p>
                        {operacion.estado === 'anulada' && (
                          <p className="text-xs text-destructive">Anulada</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
