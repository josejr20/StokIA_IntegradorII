import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'
import { useKpis } from './api'

const ETIQUETAS_KPI: Record<string, string> = {
  productos_activos: 'Productos activos',
  ventas_mes_actual: 'Ventas del mes',
  alertas_activas: 'Alertas activas',
  alertas_criticas: 'Alertas críticas',
  ordenes_pendientes: 'Órdenes pendientes',
  stock_bajo: 'Stock bajo',
  productos_vencidos: 'Productos vencidos',
  productos_proximos_vencer: 'Próximos a vencer',
}

const PRIORIDADES = ['todas', 'critica', 'alta', 'media', 'baja'] as const
const CATEGORIAS = ['todas', 'riesgo_vencimiento', 'bajo_stock', 'anomalia'] as const

type Prioridad = (typeof PRIORIDADES)[number]
type Categoria = (typeof CATEGORIAS)[number]
type Filtros = { prioridad: Prioridad; categoria: Categoria }

type Alerta = {
  id: number | string
  tipo: string
  severidad: string
  mensaje: string
  estado: string
  fecha_creacion: string
  producto_id?: number | null
}

type UsuarioSesion = {
  id: number | string
}

const FILTROS_INICIALES: Filtros = { prioridad: 'todas', categoria: 'todas' }

const ETIQUETAS_CATEGORIA: Record<string, string> = {
  riesgo_vencimiento: 'Riesgo de vencimiento',
  bajo_stock: 'Bajo stock',
  anomalia: 'Anomalía',
}

const ETIQUETAS_PRIORIDAD: Record<string, string> = {
  critica: 'Crítica',
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
}

const ORDEN_PRIORIDAD: Record<string, number> = {
  critica: 0,
  alta: 1,
  media: 2,
  baja: 3,
}

function clasePrioridad(prioridad: string) {
  switch (prioridad) {
    case 'critica':
      return 'border-red-200 bg-red-50 text-red-700'
    case 'alta':
      return 'border-orange-200 bg-orange-50 text-orange-700'
    case 'media':
      return 'border-amber-200 bg-amber-50 text-amber-800'
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700'
  }
}

function leerFiltrosGuardados(usuarioId: string): Filtros {
  try {
    const guardado = window.localStorage.getItem(`stockia:us30:filtros:${usuarioId}`)
    if (!guardado) return FILTROS_INICIALES

    const valores = JSON.parse(guardado) as Partial<Filtros>
    return {
      prioridad: PRIORIDADES.includes(valores.prioridad as Prioridad)
        ? (valores.prioridad as Prioridad)
        : 'todas',
      categoria: CATEGORIAS.includes(valores.categoria as Categoria)
        ? (valores.categoria as Categoria)
        : 'todas',
    }
  } catch {
    return FILTROS_INICIALES
  }
}

function fechaLegible(fecha: string) {
  const instante = new Date(fecha)
  return Number.isNaN(instante.getTime())
    ? 'Fecha no disponible'
    : instante.toLocaleString('es-PE')
}

export default function DashboardPage() {
  const { data, isLoading, isError } = useKpis()
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIALES)
  const [filtrosCargadosPara, setFiltrosCargadosPara] = useState<string | null>(null)

  // La clave del filtro incluye el ID de la cuenta: no se mezclan preferencias
  // entre usuarios distintos que utilicen el mismo navegador.
  const {
    data: usuario,
    isPending: cargandoUsuario,
    isError: errorUsuario,
  } = useQuery({
    queryKey: ['auth', 'me', 'us30'],
    queryFn: async () => {
      const respuesta = await api.get<{ data: UsuarioSesion }>('/auth/me')
      return respuesta.data
    },
    staleTime: 0,
    refetchOnMount: 'always',
    retry: false,
  })

  const usuarioId = usuario?.id == null ? null : String(usuario.id)

  useEffect(() => {
    if (!usuarioId) {
      setFiltros(FILTROS_INICIALES)
      setFiltrosCargadosPara(null)
      return
    }

    setFiltros(leerFiltrosGuardados(usuarioId))
    setFiltrosCargadosPara(usuarioId)
  }, [usuarioId])

  useEffect(() => {
    if (!usuarioId || filtrosCargadosPara !== usuarioId) return
    try {
      window.localStorage.setItem(
        `stockia:us30:filtros:${usuarioId}`,
        JSON.stringify(filtros),
      )
    } catch {
      // Los filtros siguen funcionando si el navegador bloquea el almacenamiento.
    }
  }, [filtros, filtrosCargadosPara, usuarioId])

  const {
    data: alertas,
    isPending: cargandoAlertas,
    isError: errorAlertas,
    refetch: actualizarAlertas,
    isFetching: actualizandoAlertas,
  } = useQuery({
    queryKey: ['alertas', 'dashboard', 'us30', usuarioId],
    enabled: Boolean(usuarioId),
    queryFn: async () => {
      const respuesta = await api.get<{ data: Alerta[] }>('/alertas')
      return respuesta.data
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnMount: 'always',
    retry: false,
  })

  const alertasActivas = useMemo(
    () => (Array.isArray(alertas) ? alertas : []).filter(
      (alerta) => alerta.estado === 'nueva' || alerta.estado === 'vista',
    ),
    [alertas],
  )

  const alertasFiltradas = useMemo(() => {
    return alertasActivas
      .filter((alerta) =>
        (filtros.prioridad === 'todas' || alerta.severidad === filtros.prioridad) &&
        (filtros.categoria === 'todas' || alerta.tipo === filtros.categoria),
      )
      .sort((primera, segunda) => {
        const diferenciaPrioridad =
          (ORDEN_PRIORIDAD[primera.severidad] ?? 99) -
          (ORDEN_PRIORIDAD[segunda.severidad] ?? 99)

        if (diferenciaPrioridad !== 0) return diferenciaPrioridad
        const primeraFecha = Date.parse(primera.fecha_creacion) || 0
        const segundaFecha = Date.parse(segunda.fecha_creacion) || 0
        return segundaFecha - primeraFecha
      })
  }, [alertasActivas, filtros])

  const filtrosAplicados = filtros.prioridad !== 'todas' || filtros.categoria !== 'todas'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Indicadores operativos del inventario.
        </p>
      </div>

      {isLoading && <p className="text-muted-foreground">Cargando indicadores...</p>}
      {isError && <p className="text-destructive">No se pudieron cargar los indicadores.</p>}
      {data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Object.entries(data).map(([clave, valor]) => (
            <div key={clave} className="rounded-xl border bg-white p-4">
              <p className="text-sm text-muted-foreground">
                {ETIQUETAS_KPI[clave] ?? clave.replaceAll('_', ' ')}
              </p>
              <p className="mt-2 text-2xl font-semibold">{valor}</p>
            </div>
          ))}
        </div>
      )}

      <section className="space-y-5 rounded-xl border bg-white p-5" aria-labelledby="alertas-titulo">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="alertas-titulo" className="text-lg font-semibold">Alertas del inventario</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Filtra las alertas activas y revisa primero las de mayor urgencia.
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
            onClick={() => void actualizarAlertas()}
            disabled={!usuarioId || actualizandoAlertas}
          >
            {actualizandoAlertas ? 'Actualizando...' : 'Actualizar alertas'}
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-44 flex-1 space-y-1 sm:flex-none">
            <label htmlFor="us30-prioridad" className="block text-sm font-medium">
              Prioridad
            </label>
            <select
              id="us30-prioridad"
              className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
              value={filtros.prioridad}
              onChange={(evento) => setFiltros((actual) => ({
                ...actual,
                prioridad: evento.target.value as Prioridad,
              }))}
              disabled={cargandoUsuario}
            >
              <option value="todas">Todas las prioridades</option>
              <option value="critica">Crítica</option>
              <option value="alta">Alta</option>
              <option value="media">Media</option>
              <option value="baja">Baja</option>
            </select>
          </div>

          <div className="min-w-48 flex-1 space-y-1 sm:flex-none">
            <label htmlFor="us30-categoria" className="block text-sm font-medium">
              Categoría
            </label>
            <select
              id="us30-categoria"
              className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
              value={filtros.categoria}
              onChange={(evento) => setFiltros((actual) => ({
                ...actual,
                categoria: evento.target.value as Categoria,
              }))}
              disabled={cargandoUsuario}
            >
              <option value="todas">Todas las categorías</option>
              <option value="riesgo_vencimiento">Riesgo de vencimiento</option>
              <option value="bajo_stock">Bajo stock</option>
              <option value="anomalia">Anomalía</option>
            </select>
          </div>

          {filtrosAplicados && (
            <button
              type="button"
              className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50"
              onClick={() => setFiltros(FILTROS_INICIALES)}
            >
              Limpiar filtros
            </button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Ordenadas de mayor a menor urgencia. Se consultan nuevas alertas cada 30 segundos.
          {usuarioId && filtrosCargadosPara === usuarioId
            ? ' Los filtros se recuerdan para tu usuario en este navegador.'
            : ''}
        </p>

        {cargandoUsuario && <p className="text-sm text-muted-foreground">Verificando usuario...</p>}
        {errorUsuario && (
          <p className="text-sm text-destructive">
            No se pudo verificar tu usuario. Vuelve a iniciar sesión para consultar las alertas.
          </p>
        )}
        {usuarioId && cargandoAlertas && (
          <p className="text-sm text-muted-foreground">Cargando alertas...</p>
        )}
        {usuarioId && errorAlertas && (
          <p className="text-sm text-destructive">
            No se pudieron cargar las alertas. Comprueba que tu usuario tenga el permiso ver_alertas.
          </p>
        )}

        {usuarioId && !cargandoAlertas && !errorAlertas && (
          <>
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {alertasFiltradas.length} de {alertasActivas.length} alertas activas
            </p>

            {alertasActivas.length === 0 ? (
              <div className="rounded-lg border bg-slate-50 p-4 text-sm text-muted-foreground">
                No hay alertas activas para mostrar.
              </div>
            ) : alertasFiltradas.length === 0 ? (
              <div className="rounded-lg border bg-amber-50 p-4 text-sm text-amber-800" role="status">
                No hay resultados para los filtros seleccionados.
              </div>
            ) : (
              <ul className="space-y-3">
                {alertasFiltradas.map((alerta) => (
                  <li key={String(alerta.id)} className="rounded-lg border p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${clasePrioridad(alerta.severidad)}`}>
                        {ETIQUETAS_PRIORIDAD[alerta.severidad] ?? alerta.severidad}
                      </span>
                      <span className="text-sm font-medium">
                        {ETIQUETAS_CATEGORIA[alerta.tipo] ?? alerta.tipo}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Estado: {alerta.estado === 'nueva' ? 'Nueva' : 'Vista'}
                      </span>
                    </div>
                    <p className="mt-2 text-sm">{alerta.mensaje}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {fechaLegible(alerta.fecha_creacion)}
                      {alerta.producto_id != null ? ` · Producto #${alerta.producto_id}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </div>
  )
}
