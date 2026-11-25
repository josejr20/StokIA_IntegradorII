import { Link } from 'react-router'

import { useAuth, type PermisoCodigo } from '@/auth/AuthContext'
import { useResumenInicio, type IndicadoresInicio } from '@/features/dashboard/api'
import { NAV } from '@/layout/Sidebar'

const ETIQUETAS_SEVERIDAD: Record<string, string> = {
  critica: 'Crítica',
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
  info: 'Información',
}

const ETIQUETAS_INDICADOR: Record<keyof IndicadoresInicio, string> = {
  productos_activos: 'Productos activos',
  ventas_mes_actual: 'Ventas del mes',
  alertas_activas: 'Alertas activas',
  alertas_criticas: 'Alertas críticas',
  stock_bajo: 'Stock bajo',
  ordenes_pendientes: 'Órdenes pendientes',
}

type Destino = [ruta: string, permiso: PermisoCodigo]

// HU-188 TC-05: a qué sección lleva cada elemento (se usa la primera a la que el usuario tenga acceso).
const DESTINO_INDICADOR: Record<keyof IndicadoresInicio, Destino[]> = {
  productos_activos: [['/productos', 'gestionar_productos'], ['/inventario', 'gestionar_inventario'], ['/dashboard', 'ver_kpis']],
  ventas_mes_actual: [['/ventas', 'gestionar_ventas'], ['/dashboard', 'ver_kpis']],
  alertas_activas: [['/riesgo-vencimiento', 'ver_alertas']],
  alertas_criticas: [['/riesgo-vencimiento', 'ver_alertas']],
  stock_bajo: [['/reabastecimiento', 'gestionar_reabastecimiento'], ['/inventario', 'gestionar_inventario'], ['/dashboard', 'ver_kpis']],
  ordenes_pendientes: [['/reabastecimiento', 'gestionar_reabastecimiento'], ['/dashboard', 'ver_kpis']],
}

const DESTINO_ALERTA: Record<string, Destino[]> = {
  bajo_stock: DESTINO_INDICADOR.stock_bajo,
  riesgo_vencimiento: [['/riesgo-vencimiento', 'ver_alertas']],
  anomalia: [['/prediccion', 'ver_kpis']],
}

function primerDestino(candidatos: Destino[] | undefined, tienePermiso: (permiso: PermisoCodigo) => boolean) {
  return candidatos?.find(([, permiso]) => tienePermiso(permiso))?.[0] ?? null
}

function formatearHora(iso: string | undefined) {
  if (!iso) return null
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return null
  return fecha.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
}

export default function InicioPage() {
  const { usuario, tienePermiso } = useAuth()
  const { data, isLoading, isError } = useResumenInicio()

  const indicadores = Object.entries(data?.kpis ?? {}) as [keyof IndicadoresInicio, number][]
  const puedeVerAlertas = tienePermiso('ver_alertas')
  const puedeVerPredicciones = tienePermiso('ver_kpis')
  const accesos = NAV.filter(({ to, permiso }) => to !== '/' && (!permiso || tienePermiso(permiso)))
  const hora = formatearHora(data?.generado_en)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Resumen general{usuario?.nombres ? `, ${usuario.nombres}` : ''}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Estado actual del inventario y las alertas pendientes{hora ? ` · actualizado a las ${hora}` : ''}.
        </p>
      </div>

      {isLoading && <p className="text-muted-foreground">Cargando resumen...</p>}
      {isError && <p className="text-destructive">No se pudo cargar el resumen.</p>}

      {data && indicadores.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {indicadores.map(([clave, valor]) => {
            const destino = primerDestino(DESTINO_INDICADOR[clave], tienePermiso)
            const contenido = (
              <>
                <p className="text-sm text-muted-foreground">{ETIQUETAS_INDICADOR[clave]}</p>
                <p className="mt-2 text-2xl font-semibold">{valor}</p>
              </>
            )
            return destino ? (
              <Link key={clave} to={destino} className="rounded-xl border bg-white p-4 transition hover:border-primary">
                {contenido}
              </Link>
            ) : (
              <div key={clave} className="rounded-xl border bg-white p-4">{contenido}</div>
            )
          })}
        </div>
      )}

      {data && !data.hay_novedades && (
        <div className="rounded-xl border bg-white p-5 text-sm text-muted-foreground">
          No hay novedades por ahora: no existen alertas ni predicciones pendientes.
        </div>
      )}

      {data && puedeVerAlertas && data.alertas_recientes.length > 0 && (
        <section className="rounded-xl border bg-white p-5">
          <h2 className="font-semibold">Alertas recientes</h2>
          <div className="mt-4 divide-y">
            {data.alertas_recientes.map((alerta) => {
              const destino = primerDestino(DESTINO_ALERTA[alerta.tipo], tienePermiso)
              return (
                <div key={alerta.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <span>{alerta.mensaje}</span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="text-muted-foreground">{ETIQUETAS_SEVERIDAD[alerta.severidad] ?? alerta.severidad}</span>
                    {destino && <Link to={destino} className="text-primary hover:underline">Ver</Link>}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {data && puedeVerPredicciones && data.predicciones_relevantes.length > 0 && (
        <section className="rounded-xl border bg-white p-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-semibold">Predicciones relevantes</h2>
            <Link to="/prediccion" className="text-sm text-primary hover:underline">Ver predicción completa</Link>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Productos de mayor venta cuya demanda estimada para los próximos {data.predicciones_relevantes[0].horizonte_dias} días supera el stock disponible.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-2">Producto</th>
                  <th className="p-2">Demanda estimada</th>
                  <th className="p-2">Stock</th>
                  <th className="p-2">Faltarían</th>
                </tr>
              </thead>
              <tbody>
                {data.predicciones_relevantes.map((prediccion) => (
                  <tr key={prediccion.producto_id} className="border-b last:border-0">
                    <td className="p-2">{prediccion.nombre}</td>
                    <td className="p-2">{prediccion.demanda_estimada}</td>
                    <td className="p-2">{prediccion.stock_disponible}</td>
                    <td className="p-2 font-medium">{prediccion.faltante}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {data && (
        <section className="rounded-xl border bg-white p-5">
          <h2 className="font-semibold">Accesos directos</h2>
          {accesos.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Tu usuario no tiene pantallas asignadas.</p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {accesos.map(({ to, label, icon: Icono }) => (
                <Link key={to} to={to} className="flex items-center gap-2 rounded-lg border p-3 text-sm transition hover:border-primary">
                  <Icono className="size-4 text-muted-foreground" />
                  {label}
                </Link>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}