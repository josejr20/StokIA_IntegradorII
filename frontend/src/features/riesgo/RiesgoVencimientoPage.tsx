import { Fragment, useMemo, useState } from 'react'
import { AlertTriangle, RefreshCcw, Search } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ApiError } from '@/lib/api'
import { useRiesgoVencimiento } from './api'
import type { LoteRiesgo, NivelFiltro, ProductoRiesgo } from './api'

type Filtro = NivelFiltro | 'todos'

const formatoNumero = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 })

const TAMANOS_PAGINA = [10, 25, 50, 100]
const TAMANO_PAGINA_INICIAL = 10

function formatoFecha(iso: string) {
  const [anio, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${anio}`
}

// Búsqueda sin distinguir mayúsculas ni tildes ("almacen" encuentra "Almacén").
function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

const NIVELES: { clave: NivelFiltro; titulo: string; clase: string }[] = [
  { clave: 'alto', titulo: 'Riesgo alto', clase: 'border-red-200 bg-red-50' },
  { clave: 'medio', titulo: 'Riesgo medio', clase: 'border-amber-200 bg-amber-50' },
  { clave: 'bajo', titulo: 'Riesgo bajo', clase: 'border-green-200 bg-green-50' },
  { clave: 'datos_insuficientes', titulo: 'Sin datos suficientes', clase: 'border-slate-200 bg-slate-50' },
]

const ETIQUETA_NIVEL: Record<NivelFiltro, string> = {
  alto: 'Alto',
  medio: 'Medio',
  bajo: 'Bajo',
  datos_insuficientes: 'Sin datos',
}

const VARIANTE_NIVEL: Record<NivelFiltro, 'alto' | 'medio' | 'bajo' | 'secondary'> = {
  alto: 'alto',
  medio: 'medio',
  bajo: 'bajo',
  datos_insuficientes: 'secondary',
}

interface Fila {
  producto: ProductoRiesgo['producto']
  productoId: number
  lote: LoteRiesgo
  texto: string // código + nombre + lote, ya normalizado, para la búsqueda
}

function nivelDeLote(lote: LoteRiesgo): NivelFiltro {
  return lote.estado === 'ok' && lote.nivel ? lote.nivel : 'datos_insuficientes'
}

function textoPlazo(lote: LoteRiesgo) {
  if (lote.fecha_vencimiento === null || lote.dias_para_vencer === null) return 'Sin fecha de vencimiento'
  const fecha = formatoFecha(lote.fecha_vencimiento)
  if (lote.dias_para_vencer < 0) return `${fecha} · vencido`
  if (lote.dias_para_vencer === 0) return `${fecha} · vence hoy`
  return `${fecha} · en ${lote.dias_para_vencer} ${lote.dias_para_vencer === 1 ? 'día' : 'días'}`
}

export default function RiesgoVencimientoPage() {
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(1)
  const [tamano, setTamano] = useState(TAMANO_PAGINA_INICIAL)
  const [abiertos, setAbiertos] = useState<number[]>([])
  const consulta = useRiesgoVencimiento()

  // Cada cambio de filtro, búsqueda o tamaño vuelve a la primera página.
  function cambiarFiltro(nuevo: Filtro) {
    setFiltro(nuevo)
    setPagina(1)
  }
  function cambiarBusqueda(texto: string) {
    setBusqueda(texto)
    setPagina(1)
  }
  function cambiarTamano(nuevo: number) {
    setTamano(nuevo)
    setPagina(1)
  }
  function alternarDetalle(loteId: number) {
    setAbiertos((actuales) =>
      actuales.includes(loteId) ? actuales.filter((id) => id !== loteId) : [...actuales, loteId],
    )
  }

  const datos = consulta.data
  const filas = useMemo<Fila[]>(
    () =>
      (datos?.productos ?? []).flatMap((producto) =>
        producto.lotes.map((lote) => ({
          producto: producto.producto,
          productoId: producto.producto_id,
          lote,
          texto: normalizar(`${producto.producto?.codigo ?? ''} ${producto.producto?.nombre ?? ''} ${lote.numero_lote}`),
        })),
      ),
    [datos],
  )

  // Todas las palabras escritas deben aparecer en el código, el nombre o el lote.
  const terminos = normalizar(busqueda).split(/\s+/).filter(Boolean)
  const visibles = filas.filter(
    (fila) =>
      (filtro === 'todos' || nivelDeLote(fila.lote) === filtro) && terminos.every((termino) => fila.texto.includes(termino)),
  )

  // Paginación: solo se dibujan las filas de la página actual (con miles de lotes la tabla completa es lenta).
  const totalPaginas = Math.max(1, Math.ceil(visibles.length / tamano))
  const paginaActual = Math.min(pagina, totalPaginas)
  const inicio = (paginaActual - 1) * tamano
  const filasPagina = visibles.slice(inicio, inicio + tamano)

  const mensajeError =
    consulta.error instanceof ApiError ? consulta.error.message : 'No se pudo calcular el riesgo de vencimiento.'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <AlertTriangle /> Riesgo de vencimiento
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Identifica qué lotes no alcanzarían a venderse antes de vencer, según su stock, la demanda estimada y la
            fecha de vencimiento.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => consulta.refetch()} disabled={consulta.isFetching}>
          <RefreshCcw className="size-4" />
          {consulta.isFetching ? 'Calculando...' : 'Actualizar'}
        </Button>
      </div>

      {consulta.isError && (
        <div role="alert" className="rounded-xl border border-destructive/40 bg-white p-4 text-sm text-destructive">
          {mensajeError}
        </div>
      )}

      {consulta.isLoading && <p className="text-sm text-muted-foreground">Calculando el riesgo de los lotes...</p>}

      {datos && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {NIVELES.map((nivel) => (
              <button
                key={nivel.clave}
                type="button"
                onClick={() => cambiarFiltro(filtro === nivel.clave ? 'todos' : nivel.clave)}
                aria-pressed={filtro === nivel.clave}
                className={`rounded-xl border p-4 text-left transition ${nivel.clase} ${
                  filtro === nivel.clave ? 'ring-2 ring-foreground/40' : ''
                }`}
              >
                <p className="text-sm text-muted-foreground">{nivel.titulo}</p>
                <p className="mt-1 text-3xl font-semibold">{datos.resumen[nivel.clave]}</p>
                <p className="text-xs text-muted-foreground">lotes</p>
              </button>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            Calculado el {new Date(datos.generado_en).toLocaleString('es-PE')} con los lotes con stock, las ventas y
            las fechas de vencimiento actuales. Riesgo alto: se estima que al menos{' '}
            {Math.round(datos.criterios.umbral_alto * 100)} % del lote no se vende a tiempo. Medio: entre{' '}
            {Math.round(datos.criterios.umbral_medio * 100)} % y {Math.round(datos.criterios.umbral_alto * 100)} %
            (sube a alto si faltan {datos.criterios.dias_urgente} días o menos). Bajo: menos de{' '}
            {Math.round(datos.criterios.umbral_medio * 100)} %.
          </p>

          {datos.resumen.lotes_analizados > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Buscar por código, nombre o lote"
                  aria-label="Buscar por código, nombre o lote"
                  value={busqueda}
                  onChange={(evento) => cambiarBusqueda(evento.target.value)}
                />
              </div>
              {(busqueda.trim() !== '' || filtro !== 'todos') && (
                <p className="text-sm text-muted-foreground">
                  {visibles.length} {visibles.length === 1 ? 'lote encontrado' : 'lotes encontrados'}
                </p>
              )}
            </div>
          )}

          {datos.resumen.lotes_analizados === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
              No hay lotes con stock para analizar.
            </div>
          ) : (
            <div className="rounded-xl border bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Lote</TableHead>
                    <TableHead>Vencimiento</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Demanda hasta vencer</TableHead>
                    <TableHead className="text-right">En riesgo</TableHead>
                    <TableHead>Nivel</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibles.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                        No hay lotes que coincidan con la búsqueda o el nivel seleccionado.
                      </TableCell>
                    </TableRow>
                  )}
                  {filasPagina.map(({ producto, productoId, lote }) => {
                    const nivel = nivelDeLote(lote)
                    const abierto = abiertos.includes(lote.lote_id)
                    return (
                      <Fragment key={lote.lote_id}>
                        <TableRow>
                          <TableCell className="font-medium">
                            {producto ? `${producto.codigo} · ${producto.nombre}` : `Producto ${productoId}`}
                          </TableCell>
                          <TableCell>{lote.numero_lote}</TableCell>
                          <TableCell>{textoPlazo(lote)}</TableCell>
                          <TableCell className="text-right">{formatoNumero.format(lote.stock)}</TableCell>
                          <TableCell className="text-right">
                            {lote.demanda_hasta_vencimiento === null ? '—' : formatoNumero.format(lote.demanda_hasta_vencimiento)}
                          </TableCell>
                          <TableCell className="text-right">
                            {lote.unidades_en_riesgo === null
                              ? '—'
                              : `${formatoNumero.format(lote.unidades_en_riesgo)} (${formatoNumero.format(lote.porcentaje_en_riesgo ?? 0)} %)`}
                          </TableCell>
                          <TableCell>
                            <Badge variant={VARIANTE_NIVEL[nivel]}>{ETIQUETA_NIVEL[nivel]}</Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              aria-expanded={abierto}
                              onClick={() => alternarDetalle(lote.lote_id)}
                            >
                              {abierto ? 'Ocultar' : 'Ver factores'}
                            </Button>
                          </TableCell>
                        </TableRow>
                        {abierto && (
                          <TableRow>
                            <TableCell colSpan={8} className="bg-muted/40">
                              <p className="text-sm font-medium">{lote.mensaje}</p>
                              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                                {lote.factores.map((factor) => (
                                  <li key={factor}>{factor}</li>
                                ))}
                              </ul>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    )
                  })}
                </TableBody>
              </Table>

              {visibles.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm">
                  <p className="text-muted-foreground">
                    Mostrando {inicio + 1}–{Math.min(inicio + tamano, visibles.length)} de {visibles.length} lotes
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-muted-foreground">
                      Filas por página
                      <select
                        className="h-8 rounded-md border bg-background px-2 text-sm text-foreground"
                        value={tamano}
                        onChange={(evento: { target: { value: string } }) => cambiarTamano(Number(evento.target.value))}
                      >
                        {TAMANOS_PAGINA.map((opcion) => (
                          <option key={opcion} value={opcion}>
                            {opcion}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={paginaActual <= 1}
                      onClick={() => setPagina(paginaActual - 1)}
                    >
                      Anterior
                    </Button>
                    <span className="text-muted-foreground">
                      Página {paginaActual} de {totalPaginas}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={paginaActual >= totalPaginas}
                      onClick={() => setPagina(paginaActual + 1)}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {datos.resumen.datos_insuficientes > 0 && (
            <p className="text-xs text-muted-foreground">
              Los lotes sin fecha de vencimiento, o de productos con poco historial de ventas, no se pueden evaluar
              todavía. Registra la fecha de vencimiento al crear el lote y carga las ventas para obtener su riesgo.
            </p>
          )}
        </>
      )}
    </div>
  )
}
