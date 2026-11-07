import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, ApiError } from '@/lib/api'

// HU-78 / HU-82: respuestas de /api/ml/*

export type EstadoVersion = 'activo' | 'requiere_revision' | 'archivado'

export interface ParametrosModelo {
  alpha: number
  beta: number
  phi: number
}

export interface MetricasModelo {
  evaluaciones: number
  mae: number | null
  rmse: number | null
  demanda_promedio: number | null
  rmse_relativo: number | null
}

export interface EvaluacionReciente {
  fecha: string
  mae: number | null
  rmse: number | null
  rmse_relativo: number | null
  evaluaciones: number
  productos_evaluados: number
  dias_evaluados: number
  umbral_rmse_relativo: number
  aprobado: boolean
}

/** HU-82 / TC-05: cuándo empezó, cuándo terminó y cuánto duró un entrenamiento. */
export interface TiempoEntrenamiento {
  iniciado_en: string
  finalizado_en: string
  duracion_ms: number
  duracion_texto?: string | null
}

/** HU-82 / TC-03: resumen de los datos históricos preparados que se usaron para entrenar. */
export interface DatosPreparados {
  total_filas: number
  filas_validas: number
  filas_descartadas: number
  motivos_descarte: Record<string, number>
}

export interface VersionModelo {
  id: number
  version: string
  nombre: string
  estado: EstadoVersion
  fecha_entrenamiento: string | null
  parametros: ParametrosModelo | null
  mae: number | null
  rmse: number | null
  demanda_promedio: number | null
  rmse_relativo: number | null
  evaluaciones: number | null
  productos_evaluados: number | null
  umbral_rmse_relativo: number
  validacion: 'independiente' | 'mismos_datos' | null
  referencia: MetricasModelo | null
  datos: { desde: string | null; hasta: string; filas_ventas: number; productos_con_ventas: number } | null
  entrenamiento: TiempoEntrenamiento | null
  ultima_evaluacion: EvaluacionReciente | null
  requiere_revision: boolean
}

export interface AvisoModelo {
  codigo: 'requiere_revision' | 'desempeno_bajo' | 'sin_modelo_activo' | 'otro_modelo_activo'
  severidad: 'info' | 'alta' | 'critica'
  modelo_id: number | null
  mensaje: string
}

/** Un intento de entrenamiento de la bitácora (incluye los que fallaron por falta de datos). */
export interface RegistroEntrenamiento {
  id: number
  modelo_id: number | null
  disparado_por: 'manual' | 'reentrenamiento'
  resultado: 'exitoso' | 'insuficiente_datos' | 'sin_mejora'
  promovido: boolean | null
  mensaje: string | null
  fecha: string | null
  duracion_ms: number | null
  duracion_texto: string | null
  iniciado_en: string | null
  finalizado_en: string | null
}

export interface EstadoModelo {
  umbral_rmse_relativo: number
  parametros_por_defecto: ParametrosModelo
  modelo_activo: VersionModelo | null
  versiones: VersionModelo[]
  ultimo_entrenamiento: RegistroEntrenamiento | null
  entrenamientos: RegistroEntrenamiento[]
  avisos: AvisoModelo[]
}

export interface ResultadoEntrenamiento {
  modelo: VersionModelo
  activado: boolean
  mensaje: string
  aviso: AvisoModelo | null
  entrenamiento: TiempoEntrenamiento
  datos_preparados: DatosPreparados
}

/** HU-82 / TC-02, TC-06: detalle que acompaña al error 422 `datos_insuficientes`. */
export interface DetalleDatosInsuficientes extends TiempoEntrenamiento {
  filas_totales: number
  filas_validas: number
  filas_descartadas: number
  motivos_descarte: Record<string, number>
  minimo_filas: number
  pruebas_logradas: number | null
  pruebas_necesarias: number | null
}

/** Si el error es "no hay datos suficientes para entrenar", devuelve su detalle; si no, null. */
export function detalleDatosInsuficientes(error: unknown): DetalleDatosInsuficientes | null {
  if (!(error instanceof ApiError) || error.status !== 422) return null
  const cuerpo = error.body as { codigo?: string; detalle?: DetalleDatosInsuficientes } | null
  return cuerpo?.codigo === 'datos_insuficientes' && cuerpo.detalle ? cuerpo.detalle : null
}

export function esDatosInsuficientes(error: unknown): boolean {
  return error instanceof ApiError && (error.body as { codigo?: string } | null)?.codigo === 'datos_insuficientes'
}

export interface ResultadoEvaluacion {
  modelo: VersionModelo | null
  evaluacion: EvaluacionReciente
  aviso: AvisoModelo | null
  mensaje: string
}

export interface ResultadoActivacion {
  modelo: VersionModelo
  mensaje: string
}

const CLAVE = ['ml-modelos']

export function useEstadoModelo() {
  return useQuery({
    queryKey: CLAVE,
    queryFn: async () => {
      const respuesta = await api.get<{ data: EstadoModelo }>('/ml/modelos')
      return respuesta.data
    },
    staleTime: 0,
    refetchOnMount: 'always',
  })
}

// Entrenar, activar o evaluar cambia el estado del modelo y puede cambiar las predicciones y el riesgo.
function useRefrescarTrasCambio() {
  const cliente = useQueryClient()
  return async () => {
    await Promise.all([
      cliente.invalidateQueries({ queryKey: CLAVE }),
      cliente.invalidateQueries({ queryKey: ['riesgo-vencimiento'] }),
    ])
  }
}

export function useEntrenarModelo() {
  const refrescar = useRefrescarTrasCambio()
  return useMutation({
    mutationFn: async () => {
      const respuesta = await api.post<{ data: ResultadoEntrenamiento }>('/ml/entrenamientos')
      return respuesta.data
    },
    onSuccess: refrescar,
  })
}

export function useActivarVersion() {
  const refrescar = useRefrescarTrasCambio()
  return useMutation({
    mutationFn: async (id: number) => {
      const respuesta = await api.post<{ data: ResultadoActivacion }>(`/ml/modelos/${id}/activar`)
      return respuesta.data
    },
    onSuccess: refrescar,
  })
}

export function useEvaluarModelo() {
  const refrescar = useRefrescarTrasCambio()
  return useMutation({
    mutationFn: async () => {
      const respuesta = await api.post<{ data: ResultadoEvaluacion }>('/ml/modelo-activo/evaluacion')
      return respuesta.data
    },
    onSuccess: refrescar,
  })
}

// ------------------------------------------------------------------------------------------ HU-88: métricas

export type CalidadModelo = 'buena' | 'aceptable' | 'requiere_revision' | 'sin_datos'
export type Tendencia = 'mejora' | 'empeora' | 'igual'

/** Cambio de una métrica entre dos versiones (para MAE/RMSE un valor menor es mejor). */
export interface VariacionMetrica {
  base: number
  nueva: number
  diferencia: number
  porcentaje: number | null
  tendencia: Tendencia
}

export interface ComparacionVersiones {
  base: { id: number; version: string }
  nueva: { id: number; version: string }
  mae: VariacionMetrica | null
  rmse: VariacionMetrica | null
  rmse_relativo: VariacionMetrica | null
  veredicto: Tendencia | 'sin_datos'
}

export interface MetricasVersion {
  id: number
  version: string
  estado: EstadoVersion
  fecha_entrenamiento: string | null
  mae: number | null
  rmse: number | null
  demanda_promedio: number | null
  rmse_relativo: number | null
  mae_relativo: number | null
  evaluaciones: number | null
  umbral_rmse_relativo: number
  cumple_umbral: boolean | null
  calidad: CalidadModelo
  requiere_revision: boolean
  interpretacion: string | null
  ultima_evaluacion: EvaluacionReciente | null
  historial_evaluaciones: EvaluacionReciente[]
  vs_anterior: ComparacionVersiones | null
}

export interface PanelMetricas {
  umbral_rmse_relativo: number
  modelo_activo_id: number | null
  mejor_version_id: number | null
  hay_modelo_entrenado: boolean
  versiones: MetricasVersion[]
}

// La clave empieza igual que la del estado: al entrenar, activar o evaluar se refresca también esta consulta.
export function useMetricasModelo() {
  return useQuery({
    queryKey: [...CLAVE, 'metricas'],
    queryFn: async () => {
      const respuesta = await api.get<{ data: PanelMetricas }>('/ml/metricas')
      return respuesta.data
    },
    staleTime: 0,
    refetchOnMount: 'always',
  })
}

/** TC-05: compara dos versiones elegidas. No consulta hasta que haya dos versiones distintas. */
export function useComparacionVersiones(base: number | null, nueva: number | null) {
  return useQuery({
    queryKey: [...CLAVE, 'comparacion', base, nueva],
    enabled: base !== null && nueva !== null && base !== nueva,
    queryFn: async () => {
      const respuesta = await api.get<{ data: ComparacionVersiones }>(`/ml/metricas/comparacion?base=${base}&nueva=${nueva}`)
      return respuesta.data
    },
  })
}
