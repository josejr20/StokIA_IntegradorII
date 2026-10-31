import { useEffect, useRef, useState } from 'react'
import { Loader2, Pencil, Plus, Search, UserRound, UserX } from 'lucide-react'
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
import {
  buscarPersonaPorDni,
  buscarPersonasPorNombre,
  type PersonaReniec,
} from '@/features/clientes/reniec'
import { buscarEmpresaPorRuc } from '@/features/clientes/ruc'
import type { Cliente } from '@/types'

// Solo se usa en pantalla: en Supabase todo se guarda en "nombre" y "documento".
type TipoPersona = 'natural' | 'juridica'

interface EdicionCliente {
  id: number | null // null = nuevo
  tipo_persona: TipoPersona
  nombres: string
  apellido_paterno: string
  apellido_materno: string
  razon_social: string
  documento: string
}

const VACIO: EdicionCliente = {
  id: null,
  tipo_persona: 'natural',
  nombres: '',
  apellido_paterno: '',
  apellido_materno: '',
  razon_social: '',
  documento: '',
}

// Como Supabase no guarda el tipo, se deduce: RUC de 11 dígitos o
// marcas típicas de razón social en el nombre.
const MARCAS_EMPRESA =
  /S\.A\.C|E\.I\.R\.L|S\.R\.L|SOCIEDAD ANONIMA|SUCESION|^GRUPO |^INVERSIONES |CORPORACION|REPRESENTACIONES|NEGOCIOS|CONCESIONARIO|RESTAURANT|CEVICHERIA|COMPANY|&/i

function esEmpresa(cliente: Pick<Cliente, 'nombre' | 'documento'>): boolean {
  return (cliente.documento ?? '').length === 11 || MARCAS_EMPRESA.test(cliente.nombre)
}

// Une nombres y apellidos (o devuelve la razón social) para guardar en "nombre".
function armarNombre(e: EdicionCliente): string {
  if (e.tipo_persona === 'juridica') return e.razon_social.trim().toUpperCase()

  return [e.nombres, e.apellido_paterno, e.apellido_materno]
    .map((parte) => parte.trim())
    .filter(Boolean)
    .join(' ')
    .toUpperCase()
}

// Clientes antiguos: solo tienen "nombre". Se propone una separación
// (últimas dos palabras = apellidos) que la persona puede corregir.
function separarNombre(nombre: string) {
  const palabras = nombre.trim().split(/\s+/).filter(Boolean)

  if (palabras.length >= 3) {
    return {
      nombres: palabras.slice(0, -2).join(' '),
      apellido_paterno: palabras[palabras.length - 2],
      apellido_materno: palabras[palabras.length - 1],
    }
  }

  return { nombres: nombre.trim(), apellido_paterno: '', apellido_materno: '' }
}

function desdeCliente(cliente: Cliente): EdicionCliente {
  if (esEmpresa(cliente)) {
    return {
      ...VACIO,
      id: cliente.id,
      tipo_persona: 'juridica',
      razon_social: cliente.nombre,
      documento: cliente.documento ?? '',
    }
  }

  return {
    ...VACIO,
    id: cliente.id,
    tipo_persona: 'natural',
    ...separarNombre(cliente.nombre),
    documento: cliente.documento ?? '',
  }
}

export default function ClientesPage() {
  const [buscar, setBuscar] = useState('')
  const [debounce, setDebounce] = useState('')
  const [edicion, setEdicion] = useState<EdicionCliente | null>(null)
  const [detalleId, setDetalleId] = useState<number | null>(null)
  const [consultando, setConsultando] = useState<'dni' | 'nombre' | 'ruc' | null>(null)
  const [candidatos, setCandidatos] = useState<PersonaReniec[]>([])
  // Último RUC consultado, para no repetir la consulta automática.
  const ultimoRuc = useRef('')

  useEffect(() => {
    const t = setTimeout(() => setDebounce(buscar), 250)
    return () => clearTimeout(t)
  }, [buscar])

  const { data: clientes, isLoading } = useClientes(debounce)
  const crearCliente = useCrearCliente()
  const actualizarCliente = useActualizarCliente()
  const { data: historial } = useHistorialCliente(detalleId)

  const detalle = clientes?.find((c) => c.id === detalleId) ?? null
  const esNatural = edicion?.tipo_persona === 'natural'

  function abrirEdicion(valor: EdicionCliente | null) {
    ultimoRuc.current = ''
    setCandidatos([])
    setConsultando(null)
    setEdicion(valor)
  }

  function aplicarPersona(persona: PersonaReniec) {
    setEdicion((actual) =>
      actual
        ? {
            ...actual,
            documento: persona.dni,
            nombres: persona.nombres,
            apellido_paterno: persona.apellido_paterno,
            apellido_materno: persona.apellido_materno,
          }
        : actual
    )
    setCandidatos([])
  }

  // DNI  ->  nombres y apellidos
  async function consultarPorDni() {
    if (!edicion) return

    const dni = edicion.documento.trim()
    if (!/^\d{8}$/.test(dni)) {
      toast.error('Escribe un DNI de 8 dígitos')
      return
    }

    setConsultando('dni')
    try {
      const persona = await buscarPersonaPorDni(dni)
      aplicarPersona(persona)
      toast.success('Datos completados desde RENIEC')
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'No se pudo consultar el DNI')
    } finally {
      setConsultando(null)
    }
  }

  // RUC  ->  razón social
  async function consultarPorRuc() {
    if (!edicion) return

    const ruc = edicion.documento.trim()
    if (!/^\d{11}$/.test(ruc)) {
      toast.error('Escribe un RUC de 11 dígitos')
      return
    }

    ultimoRuc.current = ruc
    setConsultando('ruc')
    try {
      const empresa = await buscarEmpresaPorRuc(ruc)

      setEdicion((actual) =>
        actual ? { ...actual, razon_social: empresa.razon_social } : actual
      )

      const observado =
        (empresa.estado && empresa.estado !== 'ACTIVO') ||
        (empresa.condicion && empresa.condicion !== 'HABIDO')

      if (observado) {
        toast.warning(
          `Razón social completada, pero el RUC figura como ${empresa.estado} / ${empresa.condicion}`
        )
      } else {
        toast.success('RUC válido, razón social completada')
      }
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'No se pudo consultar el RUC')
    } finally {
      setConsultando(null)
    }
  }

  // Al completar los 11 dígitos del RUC: validar y traer la razón social.
  // Solo se lanza si la razón social está vacía, para no pisar lo escrito.
  useEffect(() => {
    if (!edicion || edicion.tipo_persona !== 'juridica') return

    const ruc = edicion.documento

    if (ruc.length < 11) {
      ultimoRuc.current = ''
      return
    }

    if (ruc.length === 11 && ruc !== ultimoRuc.current && !edicion.razon_social.trim()) {
      consultarPorRuc()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edicion?.documento, edicion?.tipo_persona])

  // Nombres y apellidos  ->  DNI
  async function consultarPorNombre() {
    if (!edicion) return

    if (!edicion.nombres.trim() || !edicion.apellido_paterno.trim()) {
      toast.error('Escribe al menos los nombres y el apellido paterno')
      return
    }

    setConsultando('nombre')
    setCandidatos([])
    try {
      const personas = await buscarPersonasPorNombre({
        nombres: edicion.nombres,
        apellido_paterno: edicion.apellido_paterno,
        apellido_materno: edicion.apellido_materno,
      })

      if (personas.length === 0) {
        toast.error('No se encontró a nadie con esos datos')
      } else if (personas.length === 1) {
        aplicarPersona(personas[0])
        toast.success('DNI encontrado')
      } else {
        setCandidatos(personas)
        toast.info(`Hay ${personas.length} coincidencias, elige una`)
      }
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'No se pudo consultar RENIEC')
    } finally {
      setConsultando(null)
    }
  }

  async function guardar() {
    if (!edicion) return

    const documento = edicion.documento.trim()

    if (edicion.tipo_persona === 'natural') {
      if (!edicion.nombres.trim() || !edicion.apellido_paterno.trim()) {
        toast.error('Los nombres y el apellido paterno son obligatorios')
        return
      }
      if (documento && !/^\d{8}$/.test(documento)) {
        toast.error('El DNI debe tener 8 dígitos')
        return
      }
    } else {
      if (!edicion.razon_social.trim()) {
        toast.error('La razón social es obligatoria')
        return
      }
      if (documento && !/^\d{11}$/.test(documento)) {
        toast.error('El RUC debe tener 11 dígitos')
        return
      }
    }

    // En Supabase solo se guardan estas dos columnas.
    const datos = {
      nombre: armarNombre(edicion),
      documento: documento || null,
    }

    try {
      if (edicion.id === null) {
        await crearCliente.mutateAsync(datos)
        toast.success('Cliente registrado')
      } else {
        await actualizarCliente.mutateAsync({ id: edicion.id, datos })
        toast.success('Cliente actualizado')
      }
      abrirEdicion(null)
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

  const guardando = crearCliente.isPending || actualizarCliente.isPending

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Clientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Los clientes se asocian a cada venta, devolución y ajuste relacionado.
          </p>
        </div>
        <Button onClick={() => abrirEdicion(VACIO)}>
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
                  {esEmpresa(cliente) && (
                    <span className="ml-2 text-xs text-muted-foreground">Empresa</span>
                  )}
                </td>
                <td className="p-4">{cliente.documento ?? '-'}</td>
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
                      onClick={() => abrirEdicion(desdeCliente(cliente))}
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
      <Dialog open={edicion !== null} onOpenChange={(abierto) => !abierto && abrirEdicion(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{edicion?.id === null ? 'Nuevo cliente' : 'Editar cliente'}</DialogTitle>
          </DialogHeader>
          {edicion && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={esNatural ? 'default' : 'outline'}
                  onClick={() => {
                    setCandidatos([])
                    setEdicion({ ...edicion, tipo_persona: 'natural' })
                  }}
                >
                  Persona
                </Button>
                <Button
                  type="button"
                  variant={!esNatural ? 'default' : 'outline'}
                  onClick={() => {
                    setCandidatos([])
                    setEdicion({ ...edicion, tipo_persona: 'juridica' })
                  }}
                >
                  Empresa
                </Button>
              </div>

              {esNatural ? (
                <>
                  <div className="space-y-2">
                    <Label>DNI</Label>
                    <div className="flex gap-2">
                      <Input
                        inputMode="numeric"
                        maxLength={8}
                        value={edicion.documento}
                        onChange={(e) =>
                          setEdicion({ ...edicion, documento: e.target.value.replace(/\D/g, '') })
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            consultarPorDni()
                          }
                        }}
                        placeholder="8 dígitos (opcional)"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={consultarPorDni}
                        disabled={consultando !== null}
                        title="Completar nombres y apellidos desde el DNI"
                      >
                        {consultando === 'dni' ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Search className="size-4" />
                        )}
                        Buscar nombres
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>
                      Nombres <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      autoFocus
                      className="uppercase"
                      value={edicion.nombres}
                      onChange={(e) => setEdicion({ ...edicion, nombres: e.target.value })}
                      placeholder="Ej. JUDITH MERCEDES"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>
                        Apellido paterno <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        className="uppercase"
                        value={edicion.apellido_paterno}
                        onChange={(e) => setEdicion({ ...edicion, apellido_paterno: e.target.value })}
                        placeholder="Ej. GUTIERREZ"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Apellido materno</Label>
                      <Input
                        className="uppercase"
                        value={edicion.apellido_materno}
                        onChange={(e) => setEdicion({ ...edicion, apellido_materno: e.target.value })}
                        placeholder="Ej. RIVERA"
                      />
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={consultarPorNombre}
                    disabled={consultando !== null}
                  >
                    {consultando === 'nombre' ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Search className="size-4" />
                    )}
                    Buscar DNI por nombres y apellidos
                  </Button>

                  {candidatos.length > 0 && (
                    <div className="space-y-1 rounded-md border p-2">
                      <p className="px-1 text-xs text-muted-foreground">
                        Elige la persona correcta:
                      </p>
                      {candidatos.map((persona) => (
                        <button
                          key={persona.dni}
                          type="button"
                          onClick={() => aplicarPersona(persona)}
                          className="flex w-full cursor-pointer items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                        >
                          <span>
                            {persona.nombres} {persona.apellido_paterno} {persona.apellido_materno}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {persona.dni}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>RUC</Label>
                    <div className="flex gap-2">
                      <Input
                        autoFocus
                        inputMode="numeric"
                        maxLength={11}
                        value={edicion.documento}
                        onChange={(e) =>
                          setEdicion({ ...edicion, documento: e.target.value.replace(/\D/g, '') })
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            consultarPorRuc()
                          }
                        }}
                        placeholder="11 dígitos (opcional)"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={consultarPorRuc}
                        disabled={consultando !== null}
                        title="Validar el RUC y traer la razón social"
                      >
                        {consultando === 'ruc' ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Search className="size-4" />
                        )}
                        Validar y buscar
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>
                      Razón social <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      className="uppercase"
                      value={edicion.razon_social}
                      onChange={(e) => setEdicion({ ...edicion, razon_social: e.target.value })}
                      placeholder="Nombre de la empresa"
                    />
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => abrirEdicion(null)}>Cancelar</Button>
            <Button onClick={guardar} disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar'}
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
                  <p className="text-xs uppercase text-muted-foreground">
                    {esEmpresa(detalle) ? 'RUC' : 'Documento'}
                  </p>
                  <p>{detalle.documento ?? '-'}</p>
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