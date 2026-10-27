import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, RefreshCw, Search } from 'lucide-react'
import { useRecomendaciones, type Prioridad } from './api'

const ETIQUETA_PRIORIDAD: Record<Prioridad, string> = {
  alta: 'Alta', media: 'Media', baja: 'Baja',
}
const COLOR_PRIORIDAD: Record<Prioridad, string> = {
  alta: 'bg-red-100 text-red-800',
  media: 'bg-amber-100 text-amber-800',
  baja: 'bg-emerald-100 text-emerald-800',
}

export default function PrediccionPage() {
  const { data, isLoading, isError, refetch, isFetching } = useRecomendaciones()
  const [busqueda, setBusqueda] = useState('')
  const [prioridadFiltro, setPrioridadFiltro] = useState<'todas' | Prioridad>('todas')

  const lista = data?.data ?? []
  const totalAlta = lista.filter(item => item.prioridad === 'alta').length
  const totalMedia = lista.filter(item => item.prioridad === 'media').length
  const totalBaja = lista.filter(item => item.prioridad === 'baja').length
  const visibles = useMemo(() => {
    const busquedaNormalizada = busqueda.trim().toLocaleLowerCase('es')
    return lista.filter(item => {
      const coincidePrioridad = prioridadFiltro === 'todas' || item.prioridad === prioridadFiltro
      const coincideTexto = !busquedaNormalizada ||
        `${item.codigo} ${item.nombre}`.toLocaleLowerCase('es').includes(busquedaNormalizada)
      return coincidePrioridad && coincideTexto
    })
  }, [lista, busqueda, prioridadFiltro])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Recomendaciones de productos prioritarios</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            US-21: sugerencias basadas en stock, ventas recientes y fechas de vencimiento.
          </p>
        </div>
        <button type="button" onClick={() => void refetch()} disabled={isFetching}
          className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50">
          <RefreshCw size={16} aria-hidden="true" /> Actualizar
        </button>
      </div>

      <p className="rounded-lg border bg-slate-50 p-3 text-sm text-slate-700">
        Las ventas netas de los últimos 30 días se usan para calcular un promedio sencillo.
        Esto <strong>no es una predicción generada por inteligencia artificial</strong>.
        Cuando no hay ventas recientes, el sistema lo indica y no inventa demanda.
      </p>

      {isLoading && <p role="status" className="text-muted-foreground">Consultando productos y lotes...</p>}
      {isError && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          No se pudieron cargar las recomendaciones. Comprueba que el Backend esté funcionando y que tengas acceso al módulo.
        </div>
      )}

      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border bg-white p-4">
              <p className="text-sm text-muted-foreground">Prioridad alta</p>
              <p className="mt-1 text-2xl font-semibold text-red-700">{totalAlta}</p>
            </div>
            <div className="rounded-xl border bg-white p-4">
              <p className="text-sm text-muted-foreground">Prioridad media</p>
              <p className="mt-1 text-2xl font-semibold text-amber-700">{totalMedia}</p>
            </div>
            <div className="rounded-xl border bg-white p-4">
              <p className="text-sm text-muted-foreground">Sin acción prioritaria</p>
              <p className="mt-1 text-2xl font-semibold text-emerald-700">{totalBaja}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="relative min-w-56 flex-1">
              <span className="sr-only">Buscar producto por código o nombre</span>
              <Search aria-hidden="true" size={17} className="absolute left-3 top-3 text-muted-foreground" />
              <input value={busqueda} onChange={event => setBusqueda(event.target.value)}
                placeholder="Buscar por código o nombre..."
                className="w-full rounded-lg border bg-white py-2 pl-10 pr-3 text-sm" />
            </label>
            <label className="flex items-center gap-2 text-sm">
              Prioridad:
              <select value={prioridadFiltro}
                onChange={event => setPrioridadFiltro(event.target.value as 'todas' | Prioridad)}
                className="rounded-lg border bg-white px-3 py-2">
                <option value="todas">Todas</option>
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja / sin acción</option>
              </select>
            </label>
          </div>

          {visibles.length === 0 ? (
            <p className="rounded-xl border p-5 text-sm text-muted-foreground">
              No hay productos para el filtro seleccionado.
            </p>
          ) : (
            <div className="space-y-3">
              {visibles.map(item => (
                <article key={item.producto_id} className="rounded-xl border bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">{item.codigo}</p>
                      <h2 className="text-lg font-semibold">{item.nombre}</h2>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${COLOR_PRIORIDAD[item.prioridad]}`}>
                      Prioridad {ETIQUETA_PRIORIDAD[item.prioridad]}
                    </span>
                  </div>
                  <div className="mt-3 flex items-start gap-2">
                    {item.prioridad === 'baja'
                      ? <CheckCircle2 aria-hidden="true" className="mt-0.5 shrink-0 text-emerald-600" size={18} />
                      : <AlertTriangle aria-hidden="true" className="mt-0.5 shrink-0 text-amber-600" size={18} />}
                    <div>
                      <p className="font-medium">Acción recomendada: {item.accion}</p>
                      <p className="mt-1 text-sm text-muted-foreground"><strong>Motivo:</strong> {item.motivo}</p>
                    </div>
                  </div>
                  <dl className="mt-4 grid gap-2 border-t pt-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <div><dt className="text-muted-foreground">Stock disponible</dt><dd className="font-semibold">{item.stock_disponible}</dd></div>
                    <div><dt className="text-muted-foreground">Stock vencido</dt><dd className="font-semibold">{item.stock_vencido}</dd></div>
                    <div><dt className="text-muted-foreground">Demanda estimada (7 días)</dt><dd className="font-semibold">{item.demanda_con_historial ? item.demanda_estimada_7_dias : 'Sin datos suficientes'}</dd></div>
                    <div><dt className="text-muted-foreground">Próximo vencimiento</dt><dd className="font-semibold">{item.fecha_proximo_vencimiento ?? 'No registrado'}</dd></div>
                  </dl>
                </article>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Mostrando {visibles.length} de {lista.length} productos activos. Información de consulta, sin modificar el inventario.
          </p>
        </>
      )}
    </div>
  )
}
