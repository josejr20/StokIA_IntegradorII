import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'

// HU-78: respuestas de /api/ml/*

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
  ultima_evaluacion: EvaluacionReciente | null
}

export interface AvisoModelo {
  codigo: 'requiere_revision' | 'desempeno_bajo' | 'sin_modelo_activo'
  severidad: 'info' | 'alta' | 'critica'
  modelo_id: number | null
  mensaje: string
}

export interface EstadoModelo {
  umbral_rmse_relativo: number
  parametros_por_defecto: ParametrosModelo
  modelo_activo: VersionModelo | null
  versiones: VersionModelo[]
  ultimo_entrenamiento: {
    id: number
    modelo_id: number | null
    estado: 'en_progreso' | 'completado' | 'fallido'
    detalle: string | null
    iniciado_en: string | null
    finalizado_en: string | null
  } | null
  avisos: AvisoModelo[]
}

export interface ResultadoEntrenamiento {
  modelo: VersionModelo
  activado: boolean
  mensaje: string
  aviso: AvisoModelo | null
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
