import { Brain, CheckCircle2, TriangleAlert, X } from 'lucide-react'

import { useAuth } from '@/auth/AuthContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ApiError } from '@/lib/api'
import MetricasPanel from './MetricasPanel'
import {
  detalleDatosInsuficientes,
  esDatosInsuficientes,
  useActivarVersion,
  useEntrenarModelo,
  useEstadoModelo,
  useEvaluarModelo,
} from './api'
import type {
  AvisoModelo,
  DetalleDatosInsuficientes,
  EstadoVersion,
  ParametrosModelo,
  RegistroEntrenamiento,
  ResultadoEntrenamiento,
  VersionModelo,
} from './api'

const formatoNumero = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 2 })

function porcentaje(valor: number | null) {
  return valor === null ? '—' : `${(valor * 100).toLocaleString('es-PE', { maximumFractionDigits: 1 })} %`
}

function numero(valor: number | null) {
  return valor === null ? '—' : formatoNumero.format(valor)
}

function fechaHora(iso: string | null) {
  return iso ? new Date(iso).toLocaleString('es-PE') : '—'
}

/** HU-82 / TC-05: duración legible a partir de milisegundos ("850 ms", "1,4 s", "2 min 5 s"). */
function formatoDuracion(ms: number | null | undefined) {
  if (ms === null || ms === undefined) return '—'
  if (ms < 1000) return `${Math.round(ms)} ms`
  if (ms < 60000) return `${String(Math.round(ms / 100) / 10).replace('.', ',')} s`
  return `${Math.floor(ms / 60000)} min ${Math.round((ms % 60000) / 1000)} s`
}

function textoParametros(parametros: ParametrosModelo | null) {
  return parametros ? `α ${parametros.alpha} · β ${parametros.beta} · φ ${parametros.phi}` : '—'
}

function mensajeDeError(error: unknown, porDefecto: string) {
  return error instanceof ApiError ? error.message : porDefecto
}

const ETIQUETA_ESTADO: Record<EstadoVersion, string> = {
  activo: 'Activo',
  requiere_revision: 'Requiere revisión',
  archivado: 'Archivado',
}

// Verde = en uso, ámbar = pendiente de revisar, gris = archivado.
const VARIANTE_ESTADO: Record<EstadoVersion, 'bajo' | 'medio' | 'secondary'> = {
  activo: 'bajo',
  requiere_revision: 'medio',
  archivado: 'secondary',
}

const ETIQUETA_RESULTADO: Record<RegistroEntrenamiento['resultado'], string> = {
  exitoso: 'Exitoso',
  sin_mejora: 'Sin mejora',
  insuficiente_datos: 'Datos insuficientes',
}

const VARIANTE_RESULTADO: Record<RegistroEntrenamiento['resultado'], 'bajo' | 'medio' | 'secondary'> = {
  exitoso: 'bajo',
  sin_mejora: 'secondary',
  insuficiente_datos: 'medio',
}

const CLASE_AVISO: Record<AvisoModelo['severidad'], string> = {
  info: 'border-slate-300 bg-slate-50',
  alta: 'border-amber-300 bg-amber-50',
  critica: 'border-red-300 bg-red-50',
}

function Indicador({ titulo, valor, detalle }: { titulo: string; valor: string; detalle?: string }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{titulo}</p>
      <p className="mt-1 text-2xl font-semibold">{valor}</p>
      {detalle && <p className="text-xs text-muted-foreground">{detalle}</p>}
    </div>
  )
}

function TarjetaActivo({ modelo, umbral }: { modelo: VersionModelo; umbral: number }) {
  const cumple = modelo.rmse_relativo !== null && modelo.rmse_relativo <= umbral
  const referencia = modelo.referencia?.rmse_relativo ?? null
  const mejora =
    referencia !== null && referencia > 0 && modelo.rmse_relativo !== null
      ? ((referencia - modelo.rmse_relativo) / referencia) * 100
      : null
  const evaluacion = modelo.ultima_evaluacion

  return (
    <div className="space-y-4 rounded-xl border bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">
          Modelo activo · {modelo.version}
          <span className="ml-2 text-sm font-normal text-muted-foreground">{modelo.nombre}</span>
        </h2>
        <Badge variant={cumple ? 'bajo' : 'alto'}>{cumple ? 'Cumple el umbral' : 'Supera el umbral'}</Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador titulo="MAE" valor={numero(modelo.mae)} detalle="error absoluto medio, unidades por semana" />
        <Indicador titulo="RMSE" valor={numero(modelo.rmse)} detalle="raíz del error cuadrático medio" />
        <Indicador
          titulo="RMSE relativo"
          valor={porcentaje(modelo.rmse_relativo)}
          detalle={`umbral aceptable: ${porcentaje(umbral)}`}
        />
        <Indicador titulo="Parámetros" valor={textoParametros(modelo.parametros)} />
      </div>

      <p className="text-sm text-muted-foreground">
        Entrenado el {fechaHora(modelo.fecha_entrenamiento)} con {modelo.datos?.filas_ventas ?? '—'} registros de venta
        de {modelo.datos?.productos_con_ventas ?? '—'} productos
        {modelo.datos?.desde ? ` (del ${modelo.datos.desde} al ${modelo.datos.hasta})` : ''}. Medido sobre{' '}
        {modelo.evaluaciones ?? '—'} pruebas de predicción de {modelo.productos_evaluados ?? '—'} productos.
        {mejora !== null &&
          ` Frente a los parámetros por defecto (RMSE relativo ${porcentaje(referencia)}), ${
            mejora >= 0 ? `mejora ${numero(mejora)} %` : `empeora ${numero(-mejora)} %`
          }.`}
      </p>
      {modelo.validacion === 'mismos_datos' && (
        <p className="text-xs text-amber-700">
          Había poco historial para separar los datos de medición: las métricas pueden ser optimistas.
        </p>
      )}
      {evaluacion && (
        <p className="text-sm">
          Última evaluación con ventas recientes ({fechaHora(evaluacion.fecha)}): RMSE relativo{' '}
          <strong>{porcentaje(evaluacion.rmse_relativo)}</strong> ·{' '}
          {evaluacion.aprobado ? 'dentro del umbral' : 'por encima del umbral'}.
        </p>
      )}
    </div>
  )
}

/** Estado final de la versión recién entrenada, en palabras para el administrador. */
function textoEstadoEntrenamiento(resultado: ResultadoEntrenamiento) {
  if (resultado.activado) return 'Entrenamiento exitoso'
  return 'Entrenamiento completado'
}

/**
 * HU-82 / FE-01 / TC-07: confirmación del entrenamiento para el administrador.
 * Muestra la versión creada, cuándo se entrenó, cuánto tardó, con qué datos y qué desempeño tuvo.
 */
export function ConfirmacionEntrenamiento({ resultado, onCerrar }: { resultado: ResultadoEntrenamiento; onCerrar: () => void }) {
  const { modelo, entrenamiento, datos_preparados: datos } = resultado
  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-xl border p-4 text-sm ${resultado.activado ? 'border-green-300 bg-green-50' : 'border-amber-300 bg-amber-50'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <CheckCircle2 className={`mt-0.5 size-5 shrink-0 ${resultado.activado ? 'text-green-600' : 'text-amber-600'}`} aria-hidden />
          <div>
            <p className="font-semibold">
              {textoEstadoEntrenamiento(resultado)} · {modelo.version}
            </p>
            <p className="mt-1">{resultado.mensaje}</p>
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onCerrar} aria-label="Cerrar confirmación">
          <X className="size-4" aria-hidden />
        </Button>
      </div>

      <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs text-muted-foreground">Versión guardada</dt>
          <dd className="font-medium">{modelo.version}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Fecha del entrenamiento</dt>
          <dd className="font-medium">{fechaHora(entrenamiento.iniciado_en)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Duración</dt>
          <dd className="font-medium">{formatoDuracion(entrenamiento.duracion_ms)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">RMSE relativo</dt>
          <dd className="font-medium">
            {porcentaje(modelo.rmse_relativo)} <span className="text-xs font-normal text-muted-foreground">(umbral {porcentaje(modelo.umbral_rmse_relativo)})</span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Datos usados</dt>
          <dd className="font-medium">{formatoNumero.format(datos.filas_validas)} filas de venta válidas</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Filas descartadas</dt>
          <dd className="font-medium">{formatoNumero.format(datos.filas_descartadas)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Parámetros elegidos</dt>
          <dd className="font-medium">{textoParametros(modelo.parametros)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Estado de la versión</dt>
          <dd className="font-medium">{ETIQUETA_ESTADO[modelo.estado]}</dd>
        </div>
      </dl>
    </div>
  )
}

/**
 * HU-82 / TC-02 y TC-06: cuando no hay datos suficientes NO se entrena y se explica por qué, con números.
 * No es un fallo del sistema: es un aviso de que primero hay que cargar más historial de ventas.
 */
export function AvisoDatosInsuficientes({ mensaje, detalle }: { mensaje: string; detalle: DetalleDatosInsuficientes | null }) {
  return (
    <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
      <div className="flex items-start gap-2">
        <TriangleAlert className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden />
        <div>
          <p className="font-semibold">No es posible entrenar con la información disponible</p>
          <p className="mt-1">{mensaje}</p>
          {detalle && (
            <ul className="mt-2 list-inside list-disc text-muted-foreground">
              <li>
                Filas de venta válidas: {formatoNumero.format(detalle.filas_validas)} de {formatoNumero.format(detalle.minimo_filas)} necesarias
                {detalle.filas_descartadas > 0 && ` (${formatoNumero.format(detalle.filas_descartadas)} descartadas por datos inválidos)`}.
              </li>
              {detalle.pruebas_necesarias !== null && detalle.pruebas_logradas !== null && (
                <li>
                  Pruebas de predicción posibles: {detalle.pruebas_logradas} de {detalle.pruebas_necesarias} necesarias (los productos
                  necesitan más días de historial).
                </li>
              )}
              <li>Intento registrado el {fechaHora(detalle.iniciado_en)} · duración {formatoDuracion(detalle.duracion_ms)}.</li>
            </ul>
          )}
          <p className="mt-2">Registra o importa más ventas históricas y vuelve a intentarlo. No se creó ninguna versión.</p>
        </div>
      </div>
    </div>
  )
}

export default function ModeloMLPage() {
  const { tienePermiso } = useAuth()
  const puedeAdministrar = tienePermiso('gestionar_usuarios')

  const estado = useEstadoModelo()
  const entrenar = useEntrenarModelo()
  const activar = useActivarVersion()
  const evaluar = useEvaluarModelo()
  const ocupado = entrenar.isPending || activar.isPending || evaluar.isPending

  const datos = estado.data

  function activarVersion(version: VersionModelo) {
    const otroActivo = datos?.avisos.some((aviso) => aviso.codigo === 'otro_modelo_activo') ?? false
    if (version.estado === 'requiere_revision' || otroActivo) {
      const motivo = otroActivo
        ? 'Hay un modelo activo de otro algoritmo y activar esta versión lo desactivará.'
        : 'No alcanzó el desempeño mínimo.'
      if (!window.confirm(`Versión ${version.version}: ${motivo} ¿Seguro que quieres ponerla en uso?`)) return
    }
    activar.mutate(version.id)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Brain /> Modelo de Machine Learning
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Entrena el modelo de predicción de demanda con el historial de ventas, mide su desempeño y conserva cada
            versión. El RMSE relativo compara el error típico de la predicción semanal con la demanda semanal promedio.
          </p>
        </div>
        {puedeAdministrar ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => evaluar.mutate()} disabled={ocupado}>
              {evaluar.isPending ? 'Evaluando...' : 'Evaluar desempeño actual'}
            </Button>
            <Button type="button" onClick={() => entrenar.mutate()} disabled={ocupado}>
              {entrenar.isPending ? 'Entrenando...' : datos?.modelo_activo ? 'Reentrenar modelo' : 'Entrenar modelo'}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Solo el administrador puede entrenar o reentrenar el modelo.</p>
        )}
      </div>

      {entrenar.isPending && (
        <p className="text-sm text-muted-foreground">
          Entrenando con el historial de ventas. Puede tardar algunos segundos...
        </p>
      )}

      {entrenar.data && <ConfirmacionEntrenamiento resultado={entrenar.data} onCerrar={() => entrenar.reset()} />}
      {entrenar.error && esDatosInsuficientes(entrenar.error) && (
        <AvisoDatosInsuficientes
          mensaje={mensajeDeError(entrenar.error, 'No hay datos suficientes para entrenar.')}
          detalle={detalleDatosInsuficientes(entrenar.error)}
        />
      )}
      {evaluar.data && (
        <div
          role="status"
          className={`rounded-xl border p-4 text-sm ${evaluar.data.aviso ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50'}`}
        >
          {evaluar.data.mensaje}
        </div>
      )}
      {activar.data && (
        <div role="status" className="rounded-xl border border-green-300 bg-green-50 p-4 text-sm">
          {activar.data.mensaje}
        </div>
      )}
      {[entrenar.error && esDatosInsuficientes(entrenar.error) ? null : entrenar.error, evaluar.error, activar.error].map(
        (error, indice) =>
          error && (
            <div key={indice} role="alert" className="rounded-xl border border-destructive/40 bg-white p-4 text-sm text-destructive">
              {mensajeDeError(error, 'No se pudo completar la acción.')}
            </div>
          ),
      )}

      {estado.isLoading && <p className="text-sm text-muted-foreground">Cargando el estado del modelo...</p>}
      {estado.isError && (
        <div role="alert" className="rounded-xl border border-destructive/40 bg-white p-4 text-sm text-destructive">
          {mensajeDeError(estado.error, 'No se pudo cargar el estado del modelo.')}
        </div>
      )}

      {datos && (
        <>
          {datos.avisos.map((aviso) => (
            <div key={aviso.codigo} role="alert" className={`rounded-xl border p-4 text-sm ${CLASE_AVISO[aviso.severidad]}`}>
              {aviso.mensaje}
            </div>
          ))}

          {datos.modelo_activo ? (
            <TarjetaActivo modelo={datos.modelo_activo} umbral={datos.umbral_rmse_relativo} />
          ) : (
            <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
              No hay un modelo activo. Mientras tanto la predicción de demanda usa los parámetros por defecto (
              {textoParametros(datos.parametros_por_defecto)}).
            </div>
          )}

          <MetricasPanel />

          <div className="rounded-xl border bg-white">
            <div className="border-b px-5 py-3">
              <h2 className="font-semibold">Historial de versiones</h2>
              <p className="text-xs text-muted-foreground">
                Cada entrenamiento guarda una versión con su fecha y sus métricas; las anteriores se conservan.
              </p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Versión</TableHead>
                  <TableHead>Fecha de entrenamiento</TableHead>
                  <TableHead>Duración</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Parámetros</TableHead>
                  <TableHead className="text-right">MAE</TableHead>
                  <TableHead className="text-right">RMSE</TableHead>
                  <TableHead className="text-right">RMSE relativo</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {datos.versiones.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                      Todavía no se ha entrenado ninguna versión.
                    </TableCell>
                  </TableRow>
                )}
                {datos.versiones.map((version) => (
                  <TableRow key={version.id}>
                    <TableCell className="font-medium">{version.version}</TableCell>
                    <TableCell>{fechaHora(version.fecha_entrenamiento)}</TableCell>
                    <TableCell>{formatoDuracion(version.entrenamiento?.duracion_ms)}</TableCell>
                    <TableCell>
                      <Badge variant={VARIANTE_ESTADO[version.estado]}>{ETIQUETA_ESTADO[version.estado]}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{textoParametros(version.parametros)}</TableCell>
                    <TableCell className="text-right">{numero(version.mae)}</TableCell>
                    <TableCell className="text-right">{numero(version.rmse)}</TableCell>
                    <TableCell className="text-right">{porcentaje(version.rmse_relativo)}</TableCell>
                    <TableCell>
                      {puedeAdministrar && version.estado !== 'activo' && (
                        <Button type="button" variant="ghost" size="sm" disabled={ocupado} onClick={() => activarVersion(version)}>
                          Activar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="rounded-xl border bg-white">
            <div className="border-b px-5 py-3">
              <h2 className="font-semibold">Historial de entrenamientos</h2>
              <p className="text-xs text-muted-foreground">
                Cada intento queda registrado con su fecha y duración, incluso los que no se pudieron realizar por falta de datos.
              </p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead>Duración</TableHead>
                  <TableHead>Detalle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {datos.entrenamientos.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                      Todavía no se ha intentado ningún entrenamiento.
                    </TableCell>
                  </TableRow>
                )}
                {datos.entrenamientos.map((registro) => (
                  <TableRow key={registro.id}>
                    <TableCell>{fechaHora(registro.iniciado_en ?? registro.fecha)}</TableCell>
                    <TableCell>
                      <Badge variant={VARIANTE_RESULTADO[registro.resultado] ?? 'secondary'}>
                        {ETIQUETA_RESULTADO[registro.resultado] ?? registro.resultado}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatoDuracion(registro.duracion_ms)}</TableCell>
                    <TableCell className="max-w-xl whitespace-normal text-xs text-muted-foreground">{registro.mensaje ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  )
}
