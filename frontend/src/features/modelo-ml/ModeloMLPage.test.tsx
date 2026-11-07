// @vitest-environment jsdom

// HU-82 · FE-01 / QA-01 — Pantalla "Modelo de Machine Learning": entrenamiento, confirmación y falta de datos.
// La API se simula: no hace falta conexión a Supabase ni al backend.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import ModeloMLPage from './ModeloMLPage'
import type { EstadoModelo, ResultadoEntrenamiento } from './api'

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))

// Un administrador (tiene el permiso que habilita entrenar).
vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({ tienePermiso: (permiso: string) => permiso === 'gestionar_usuarios' }),
}))

// Se conserva ApiError real (la pantalla lo usa para leer el detalle del 422) y se simula solo el cliente HTTP.
vi.mock('@/lib/api', async (importarOriginal) => {
  const original = await importarOriginal<typeof import('@/lib/api')>()
  return { ...original, api: { get, post } }
})

const estadoVacio: EstadoModelo = {
  umbral_rmse_relativo: 0.3,
  parametros_por_defecto: { alpha: 0.1, beta: 0.01, phi: 0.9 },
  modelo_activo: null,
  versiones: [],
  ultimo_entrenamiento: null,
  entrenamientos: [],
  avisos: [],
}

const metricasVacias = { umbral_rmse_relativo: 0.3, modelo_activo_id: null, mejor_version_id: null, hay_modelo_entrenado: false, versiones: [] }

/** La pantalla hace dos consultas (estado del modelo y métricas): cada una recibe su propia respuesta. */
function simularGet(estado: EstadoModelo) {
  get.mockImplementation(async (ruta: string) => ({ data: ruta.startsWith('/ml/metricas') ? metricasVacias : estado }))
}

const entrenamientoExitoso: ResultadoEntrenamiento = {
  modelo: {
    id: 1,
    version: 'v1',
    nombre: 'Holt amortiguado estacional',
    estado: 'activo',
    fecha_entrenamiento: '2026-10-23T15:00:00.000Z',
    parametros: { alpha: 0.1, beta: 0.01, phi: 0.9 },
    mae: 12.5,
    rmse: 16.2,
    demanda_promedio: 90,
    rmse_relativo: 0.18,
    evaluaciones: 120,
    productos_evaluados: 12,
    umbral_rmse_relativo: 0.3,
    validacion: 'independiente',
    referencia: null,
    datos: { desde: '2026-08-01', hasta: '2026-10-22', filas_ventas: 1008, productos_con_ventas: 12 },
    entrenamiento: { iniciado_en: '2026-10-23T15:00:00.000Z', finalizado_en: '2026-10-23T15:00:02.500Z', duracion_ms: 2500, duracion_texto: '2,5 s' },
    ultima_evaluacion: null,
    requiere_revision: false,
  },
  activado: true,
  mensaje: 'Modelo v1 entrenado y activado. Duración del entrenamiento: 2,5 s.',
  aviso: null,
  entrenamiento: { iniciado_en: '2026-10-23T15:00:00.000Z', finalizado_en: '2026-10-23T15:00:02.500Z', duracion_ms: 2500, duracion_texto: '2,5 s' },
  datos_preparados: { total_filas: 1010, filas_validas: 1008, filas_descartadas: 2, motivos_descarte: { cantidad_invalida: 2 } },
}

function mostrarPagina() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={cliente}>
      <ModeloMLPage />
    </QueryClientProvider>,
  )
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('HU-82 - Entrenar modelo de predicción de demanda (pantalla)', () => {
  it('TC-07: confirma el entrenamiento exitoso con versión, fecha, duración y datos usados', async () => {
    simularGet(estadoVacio)
    post.mockResolvedValue({ data: entrenamientoExitoso })
    mostrarPagina()

    await userEvent.click(await screen.findByRole('button', { name: 'Entrenar modelo' }))

    const confirmacion = await screen.findByRole('status')
    expect(within(confirmacion).getByText(/Entrenamiento exitoso · v1/)).toBeTruthy()
    expect(within(confirmacion).getByText('2,5 s')).toBeTruthy() // TC-05: duración
    expect(within(confirmacion).getByText(/1[.,\s]?008 filas de venta válidas/)).toBeTruthy() // TC-03
    expect(post).toHaveBeenCalledWith('/ml/entrenamientos')
  })

  it('TC-07: la confirmación se puede cerrar', async () => {
    simularGet(estadoVacio)
    post.mockResolvedValue({ data: entrenamientoExitoso })
    mostrarPagina()

    await userEvent.click(await screen.findByRole('button', { name: 'Entrenar modelo' }))
    await screen.findByRole('status')
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar confirmación' }))

    await waitFor(() => expect(screen.queryByText(/Entrenamiento exitoso · v1/)).toBeNull())
  })

  it('TC-02 y TC-06: sin datos suficientes indica que no es posible entrenar y por qué', async () => {
    const { ApiError } = await import('@/lib/api')
    simularGet(estadoVacio)
    post.mockRejectedValue(
      new ApiError(422, {
        error: 'No hay datos históricos suficientes: hay 9 filas de ventas válidas y se necesitan al menos 50. No es posible entrenar el modelo con la información disponible.',
        codigo: 'datos_insuficientes',
        detalle: {
          filas_totales: 9, filas_validas: 9, filas_descartadas: 0, motivos_descarte: {}, minimo_filas: 50,
          pruebas_logradas: null, pruebas_necesarias: null,
          iniciado_en: '2026-10-23T15:00:00.000Z', finalizado_en: '2026-10-23T15:00:00.400Z', duracion_ms: 400,
        },
      }),
    )
    mostrarPagina()

    await userEvent.click(await screen.findByRole('button', { name: 'Entrenar modelo' }))

    const aviso = await screen.findByRole('alert')
    expect(within(aviso).getByText('No es posible entrenar con la información disponible')).toBeTruthy()
    expect(within(aviso).getByText(/Filas de venta válidas: 9 de 50 necesarias/)).toBeTruthy()
    expect(within(aviso).getByText(/No se creó ninguna versión/)).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull() // no hay confirmación de éxito
  })

  it('TC-05: el historial muestra la fecha y la duración de cada entrenamiento, también los fallidos', async () => {
    simularGet({
        ...estadoVacio,
        entrenamientos: [
          { id: 2, modelo_id: 1, disparado_por: 'manual', resultado: 'exitoso', promovido: true, mensaje: 'Modelo v1 entrenado y activado.', fecha: '2026-10-23T15:00:03.000Z', duracion_ms: 2500, duracion_texto: '2,5 s', iniciado_en: '2026-10-23T15:00:00.000Z', finalizado_en: '2026-10-23T15:00:02.500Z' },
          { id: 1, modelo_id: null, disparado_por: 'manual', resultado: 'insuficiente_datos', promovido: false, mensaje: 'Sin datos.', fecha: '2026-10-22T15:00:00.000Z', duracion_ms: 400, duracion_texto: '400 ms', iniciado_en: '2026-10-22T15:00:00.000Z', finalizado_en: '2026-10-22T15:00:00.400Z' },
        ],
    })
    mostrarPagina()

    expect(await screen.findByText('Historial de entrenamientos')).toBeTruthy()
    expect(screen.getByText('Exitoso')).toBeTruthy()
    expect(screen.getByText('Datos insuficientes')).toBeTruthy()
    expect(screen.getByText('2,5 s')).toBeTruthy()
    expect(screen.getByText('400 ms')).toBeTruthy()
  })

  it('solo el administrador puede entrenar: sin permiso no aparece el botón', async () => {
    vi.resetModules()
    vi.doMock('@/auth/AuthContext', () => ({ useAuth: () => ({ tienePermiso: () => false }) }))
    const { default: Pagina } = await import('./ModeloMLPage')
    simularGet(estadoVacio)
    const cliente = new QueryClient()
    render(
      <QueryClientProvider client={cliente}>
        <Pagina />
      </QueryClientProvider>,
    )
    expect(await screen.findByText(/Solo el administrador puede entrenar/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Entrenar modelo' })).toBeNull()
    vi.doUnmock('@/auth/AuthContext')
  })
})
