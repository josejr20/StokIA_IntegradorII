import { useState, type FormEvent } from 'react'
import { AlertCircle, ArrowDownUp, ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  useAuditoria,
  useOpcionesFiltroAuditoria,
  type FiltrosAuditoria,
  type RegistroAuditoria,
} from './api'

const FILAS_POR_PAGINA = 20
const FILTROS_INICIALES: FiltrosAuditoria = { usuario_id: '', entidad: '', fecha_desde: '', fecha_hasta: '', orden: 'desc' }

// Las fechas se muestran siempre en hora de Perú, sin depender de la zona del navegador.
const formatoFecha = new Intl.DateTimeFormat('es-PE', {
  dateStyle: 'medium',
  timeStyle: 'medium',
  timeZone: 'America/Lima',
})

const ESTILO_SELECT =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'

/** 'crear_productos' -> 'Creación'. El verbo sale del nombre de la acción (TC-04). */
function tipoAccion(accion: string): { etiqueta: string; variante: 'bajo' | 'medio' | 'alto' | 'secondary' } {
  if (accion.startsWith('crear')) return { etiqueta: 'Creación', variante: 'bajo' }
  if (accion.startsWith('editar') || accion.startsWith('configurar')) return { etiqueta: 'Edición', variante: 'medio' }
  if (accion.startsWith('eliminar') || accion.startsWith('anular')) return { etiqueta: 'Eliminación', variante: 'alto' }
  return { etiqueta: 'Otra', variante: 'secondary' }
}

/** Detalle de la acción: se muestra plegado para no saturar la tabla. */
function DetalleRegistro({ registro }: { registro: RegistroAuditoria }) {
  if (!registro.detalle || Object.keys(registro.detalle).length === 0) {
    return <span className="text-muted-foreground">—</span>
  }
  return (
    <details className="group">
      <summary className="cursor-pointer text-sm text-primary hover:underline">Ver detalle</summary>
      <pre className="mt-2 max-h-64 max-w-md overflow-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap break-words">
        {JSON.stringify(registro.detalle, null, 2)}
      </pre>
    </details>
  )
}

/**
 * US-36 · Módulo de auditoría (solo administradores con permiso `ver_auditoria`).
 * Muestra el historial en orden cronológico, filtrable por usuario o fecha.
 * Es de solo lectura: no hay acciones para editar ni eliminar registros.
 */
export default function AuditoriaPage() {
  const [formulario, setFormulario] = useState<FiltrosAuditoria>(FILTROS_INICIALES)
  const [aplicados, setAplicados] = useState<FiltrosAuditoria>(FILTROS_INICIALES)
  const [pagina, setPagina] = useState(1)
  const [errorFechas, setErrorFechas] = useState('')

  const opciones = useOpcionesFiltroAuditoria()
  const consulta = useAuditoria({ ...aplicados, page: pagina, limit: FILAS_POR_PAGINA })
  const registros = consulta.data?.data ?? []
  const meta = consulta.data?.meta

  function consultar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (formulario.fecha_desde && formulario.fecha_hasta && formulario.fecha_desde > formulario.fecha_hasta) {
      setErrorFechas('La fecha inicial no puede ser posterior a la final.')
      return
    }
    setErrorFechas('')
    setPagina(1)
    setAplicados(formulario)
  }

  function limpiar() {
    setFormulario(FILTROS_INICIALES)
    setAplicados(FILTROS_INICIALES)
    setPagina(1)
    setErrorFechas('')
  }

  /** Alterna entre más reciente primero y más antiguo primero (TC-07). */
  function invertirOrden() {
    const nuevo = aplicados.orden === 'asc' ? 'desc' : 'asc'
    setFormulario((f) => ({ ...f, orden: nuevo }))
    setAplicados((f) => ({ ...f, orden: nuevo }))
    setPagina(1)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Auditoría del sistema</h1>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <ShieldCheck className="size-4" />
          Historial de acciones de los usuarios. Los registros son de solo lectura y no pueden modificarse.
        </p>
      </div>

      {/* TC-05: filtros por usuario o por fecha */}
      <form onSubmit={consultar} className="space-y-3 rounded-xl border bg-card p-4" aria-label="Filtros de auditoría">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="aud-usuario">Usuario</Label>
            <select
              id="aud-usuario"
              className={ESTILO_SELECT}
              value={formulario.usuario_id}
              onChange={(e) => setFormulario({ ...formulario, usuario_id: e.target.value })}
            >
              <option value="">Todos</option>
              {opciones.data?.usuarios.map((u) => (
                <option key={u.id} value={u.id}>{u.nombre}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="aud-entidad">Módulo / entidad</Label>
            <select
              id="aud-entidad"
              className={ESTILO_SELECT}
              value={formulario.entidad}
              onChange={(e) => setFormulario({ ...formulario, entidad: e.target.value })}
            >
              <option value="">Todos</option>
              {opciones.data?.entidades.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="aud-desde">Desde</Label>
            <Input
              id="aud-desde"
              type="date"
              value={formulario.fecha_desde}
              max={formulario.fecha_hasta || undefined}
              onChange={(e) => setFormulario({ ...formulario, fecha_desde: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="aud-hasta">Hasta</Label>
            <Input
              id="aud-hasta"
              type="date"
              value={formulario.fecha_hasta}
              min={formulario.fecha_desde || undefined}
              onChange={(e) => setFormulario({ ...formulario, fecha_hasta: e.target.value })}
            />
          </div>
        </div>
        {errorFechas && <p role="alert" className="text-sm text-red-600">{errorFechas}</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="submit">Consultar</Button>
          <Button type="button" variant="outline" onClick={limpiar}>Limpiar filtros</Button>
        </div>
      </form>

      {consulta.isError && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 p-4 text-red-900">
          <AlertCircle className="mt-0.5 size-5 shrink-0" />
          <p className="text-sm">{consulta.error instanceof Error ? consulta.error.message : 'No se pudo cargar la auditoría.'}</p>
        </div>
      )}

      <section className="space-y-3 rounded-xl border bg-card p-5">
        <div className="overflow-x-auto">
          <Table className="min-w-[820px]">
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button
                    type="button"
                    onClick={invertirOrden}
                    className="inline-flex items-center gap-1 font-medium hover:underline"
                    title="Invertir orden cronológico"
                  >
                    Fecha y hora <ArrowDownUp className="size-3.5" />
                    <span className="sr-only">
                      (orden actual: {aplicados.orden === 'asc' ? 'más antiguo primero' : 'más reciente primero'})
                    </span>
                  </button>
                </TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Acción</TableHead>
                <TableHead>Entidad</TableHead>
                <TableHead>Detalle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {consulta.isLoading && (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Cargando…</TableCell></TableRow>
              )}
              {!consulta.isLoading && registros.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground" data-testid="auditoria-vacia">
                    No hay registros de auditoría para los filtros seleccionados.
                  </TableCell>
                </TableRow>
              )}
              {registros.map((registro) => {
                const tipo = tipoAccion(registro.accion)
                return (
                  <TableRow key={registro.id}>
                    <TableCell className="whitespace-nowrap">{formatoFecha.format(new Date(registro.fecha))}</TableCell>
                    <TableCell>
                      <strong>{registro.usuario_nombre ?? 'Sistema / anónimo'}</strong>
                      {registro.usuario_email && <span className="block text-xs text-muted-foreground">{registro.usuario_email}</span>}
                    </TableCell>
                    <TableCell><Badge variant={tipo.variante}>{tipo.etiqueta}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{registro.accion}</TableCell>
                    <TableCell>
                      {registro.entidad}
                      {registro.entidad_id !== null && <span className="text-muted-foreground"> #{registro.entidad_id}</span>}
                    </TableCell>
                    <TableCell><DetalleRegistro registro={registro} /></TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>

        {meta && (
          <div className="flex items-center justify-between gap-3 text-sm">
            <span>Página {meta.page} de {meta.totalPages} · {meta.total} registro(s)</span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" disabled={meta.page <= 1} onClick={() => setPagina(meta.page - 1)}>
                <ChevronLeft className="size-4" /> Anterior
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={meta.page >= meta.totalPages} onClick={() => setPagina(meta.page + 1)}>
                Siguiente <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
