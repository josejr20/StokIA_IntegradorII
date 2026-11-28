
import { useState } from 'react'
import { useKpis } from './api'

const API_URL = (
  import.meta.env.VITE_API_URL ??
  'http://localhost:3100/api'
).replace(/\/$/, '')

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

type FormatoReporte = 'pdf' | 'excel'

type Mensaje = {
  tipo: 'exito' | 'error'
  texto: string
}

export default function DashboardPage() {
  const { data, isLoading, isError } = useKpis()

  const [periodo, setPeriodo] = useState('7')
  const [descargando, setDescargando] =
    useState<FormatoReporte | null>(null)
  const [mensaje, setMensaje] = useState<Mensaje | null>(null)

  async function descargarReporte(formato: FormatoReporte) {
    if (descargando) return

    setDescargando(formato)
    setMensaje(null)

    try {
      const ruta =
        `/reportes/exportar?formato=${formato}` +
        `&dias=${periodo}`

      const solicitar = () =>
        fetch(`${API_URL}${ruta}`, {
          method: 'GET',
          credentials: 'include',
        })

      let respuesta = await solicitar()

      // Renovar la sesión una vez si el token expiró.
      if (respuesta.status === 401) {
        const renovacion = await fetch(
          `${API_URL}/auth/refresh`,
          {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        )

        if (renovacion.ok) {
          respuesta = await solicitar()
        }
      }

      if (!respuesta.ok) {
        const cuerpo = await respuesta
          .json()
          .catch(() => null)

        let detalle = 'No se pudo generar el reporte.'

        if (
          cuerpo &&
          typeof cuerpo.error === 'string'
        ) {
          detalle = cuerpo.error
        } else if (
          cuerpo &&
          typeof cuerpo.message === 'string'
        ) {
          detalle = cuerpo.message
        }

        if (respuesta.status === 401) {
          detalle =
            'Tu sesión ha expirado. Inicia sesión nuevamente.'
        }

        if (respuesta.status === 403) {
          detalle =
            'Tu usuario no tiene permiso para exportar reportes.'
        }

        throw new Error(detalle)
      }

      const archivo = await respuesta.blob()

      if (archivo.size === 0) {
        throw new Error(
          'El servidor devolvió un archivo vacío.'
        )
      }

      const primerosBytes = new Uint8Array(
        await archivo.slice(0, 5).arrayBuffer()
      )

      const archivoValido =
        formato === 'pdf'
          ? String.fromCharCode(...primerosBytes) ===
            '%PDF-'
          : primerosBytes[0] === 80 &&
            primerosBytes[1] === 75

      if (!archivoValido) {
        throw new Error(
          'El servidor devolvió un archivo con formato incorrecto.'
        )
      }

      const extension =
        formato === 'pdf' ? 'pdf' : 'xlsx'

      const nombre =
        `StockIA_Reporte_${periodo}_dias.${extension}`

      const url = URL.createObjectURL(archivo)

      const enlace = document.createElement('a')
      enlace.href = url
      enlace.download = nombre

      document.body.appendChild(enlace)
      enlace.click()
      enlace.remove()

      setTimeout(() => {
        URL.revokeObjectURL(url)
      }, 30000)

      setMensaje({
        tipo: 'exito',
        texto:
          `Se inició la descarga de ${nombre}. ` +
          'Revisa el archivo descargado.',
      })
    } catch (error) {
      setMensaje({
        tipo: 'error',
        texto:
          error instanceof Error
            ? error.message
            : 'Ocurrió un error inesperado.',
      })
    } finally {
      setDescargando(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          Dashboard
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Indicadores operativos del inventario.
        </p>
      </div>

      {isLoading && (
        <p className="text-muted-foreground">
          Cargando indicadores...
        </p>
      )}

      {isError && (
        <p className="text-destructive">
          No se pudieron cargar los indicadores.
        </p>
      )}

      {data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Object.entries(data).map(([clave, valor]) => (
            <div
              key={clave}
              className="rounded-xl border bg-white p-4"
            >
              <p className="text-sm text-muted-foreground">
                {ETIQUETAS_KPI[clave] ??
                  clave.replaceAll('_', ' ')}
              </p>

              <p className="mt-2 text-2xl font-semibold">
                {valor}
              </p>
            </div>
          ))}
        </div>
      )}

      <section className="rounded-xl border bg-white p-6">
        <div>
          <h2 className="text-xl font-semibold">
            Exportar reportes
          </h2>

          <p className="mt-2 text-sm text-muted-foreground">
            Descarga información del inventario,
            predicciones y alertas vigentes.
          </p>
        </div>

        <div className="mt-6 max-w-sm">
          <label
            htmlFor="periodo-reporte"
            className="mb-2 block text-sm font-medium"
          >
            Seleccionar periodo
          </label>

          <select
            id="periodo-reporte"
            value={periodo}
            disabled={descargando !== null}
            onChange={(evento) => {
              setPeriodo(evento.target.value)
              setMensaje(null)
            }}
            className="w-full rounded-lg border bg-white px-4 py-3 text-sm"
          >
            <option value="7">Próximos 7 días</option>
            <option value="14">Próximos 14 días</option>
            <option value="30">Próximos 30 días</option>
          </select>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => descargarReporte('pdf')}
            disabled={descargando !== null}
            className="rounded-lg bg-red-600 px-5 py-3 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {descargando === 'pdf'
              ? 'Generando PDF...'
              : 'Descargar PDF'}
          </button>

          <button
            type="button"
            onClick={() => descargarReporte('excel')}
            disabled={descargando !== null}
            className="rounded-lg bg-green-700 px-5 py-3 text-sm font-medium text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {descargando === 'excel'
              ? 'Generando Excel...'
              : 'Descargar Excel'}
          </button>
        </div>

        {mensaje && (
          <div
            role="status"
            aria-live="polite"
            className={
              mensaje.tipo === 'exito'
                ? 'mt-5 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800'
                : 'mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800'
            }
          >
            {mensaje.texto}
          </div>
        )}

        <div className="mt-6 border-t pt-4">
          <p className="text-sm font-medium">
            Contenido del reporte
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-gray-50 p-3 text-sm">
              Inventario
            </div>

            <div className="rounded-lg bg-gray-50 p-3 text-sm">
              Predicciones
            </div>

            <div className="rounded-lg bg-gray-50 p-3 text-sm">
              Alertas vigentes
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
