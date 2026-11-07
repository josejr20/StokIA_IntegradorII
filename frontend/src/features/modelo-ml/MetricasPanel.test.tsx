// @vitest-environment jsdom

// HU-88 · FE-01 / QA-01 — Panel de métricas: MAE/RMSE comprensibles, marca "requiere revisión", comparación e historial.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import MetricasPanel from './MetricasPanel'
import type { PanelMetricas, MetricasVersion } from './api'

const { get } = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/lib/api', async (importarOriginal) => {
  const original = await importarOriginal<typeof import('@/lib/api')>()
  return { ...original, api: { get, post: vi.fn() } }
})

const evaluacion = (fecha: string, rel: number, aprobado: boolean) => ({
  fecha, mae: 8, rmse: 11, rmse_relativo: rel, evaluaciones: 100, productos_evaluados: 12, dias_evaluados: 21, umbral_rmse_relativo: 0.3, aprobado,
})

function version(sobre: Partial<MetricasVersion>): MetricasVersion {
  return {
    id: 1, version: 'v1', estado: 'archivado', fecha_entrenamiento: '2026-10-01T15:00:00.000Z',
    mae: 10, rmse: 14, demanda_promedio: 50, rmse_relativo: 0.28, mae_relativo: 0.2, evaluaciones: 100,
    umbral_rmse_relativo: 0.3, cumple_umbral: true, calidad: 'aceptable', requiere_revision: false,
    interpretacion: 'En promedio, la predicción semanal de un producto se equivoca en 10 unidades (MAE). Los errores grandes pesan más: el RMSE es 14 unidades.',
    ultima_evaluacion: null, historial_evaluaciones: [], vs_anterior: null, ...sobre,
  }
}

const dosVersiones: PanelMetricas = {
  umbral_rmse_relativo: 0.3, modelo_activo_id: 2, mejor_version_id: 2, hay_modelo_entrenado: true,
  versiones: [
    version({
      id: 2, version: 'v2', estado: 'activo', mae: 6, rmse: 8, rmse_relativo: 0.16, mae_relativo: 0.12, calidad: 'buena',
      interpretacion: 'En promedio, la predicción semanal de un producto se equivoca en 6 unidades (MAE). Los errores grandes pesan más: el RMSE es 8 unidades.',
      historial_evaluaciones: [evaluacion('2026-10-20T10:00:00.000Z', 0.17, true)],
      vs_anterior: {
        base: { id: 1, version: 'v1' }, nueva: { id: 2, version: 'v2' },
        mae: { base: 10, nueva: 6, diferencia: -4, porcentaje: -40, tendencia: 'mejora' },
        rmse: { base: 14, nueva: 8, diferencia: -6, porcentaje: -42.9, tendencia: 'mejora' },
        rmse_relativo: { base: 0.28, nueva: 0.16, diferencia: -0.12, porcentaje: -42.9, tendencia: 'mejora' },
        veredicto: 'mejora',
      },
    }),
    version({ id: 1, version: 'v1' }),
  ],
}

function mostrar(datos: PanelMetricas) {
  get.mockImplementation(async (ruta: string) => {
    if (ruta.startsWith('/ml/metricas/comparacion')) {
      return { data: { base: { id: 1, version: 'v1' }, nueva: { id: 2, version: 'v2' }, mae: { base: 10, nueva: 6, diferencia: -4, porcentaje: -40, tendencia: 'mejora' }, rmse: null, rmse_relativo: null, veredicto: 'mejora' } }
    }
    return { data: datos }
  })
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={cliente}>
      <MetricasPanel />
    </QueryClientProvider>,
  )
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('HU-88 - Métricas de desempeño del modelo (pantalla)', () => {
  it('TC-01 y TC-04: muestra MAE y RMSE de la versión activa con su explicación en lenguaje claro', async () => {
    mostrar(dosVersiones)
    expect(await screen.findByText('6 u.')).toBeTruthy() // MAE de v2
    expect(screen.getByText('8 u.')).toBeTruthy() // RMSE de v2
    expect(screen.getByText(/se equivoca en 6 unidades \(MAE\)/)).toBeTruthy()
    expect(screen.getByText(/Unidades que, en promedio, se desvía/)).toBeTruthy()
    expect(screen.getAllByText('Buena').length).toBeGreaterThan(0)
    expect(screen.queryByRole('alert')).toBeNull() // no hay marca de revisión
  })

  it('TC-01: sin modelo entrenado lo indica con claridad', async () => {
    mostrar({ umbral_rmse_relativo: 0.3, modelo_activo_id: null, mejor_version_id: null, hay_modelo_entrenado: false, versiones: [] })
    expect(await screen.findByText(/Todavía no hay un modelo entrenado/)).toBeTruthy()
  })

  it('TC-02 y TC-06: marca "requiere revisión" cuando el error supera el umbral', async () => {
    mostrar({
      ...dosVersiones,
      versiones: [
        version({ id: 2, version: 'v2', estado: 'activo', rmse_relativo: 0.45, calidad: 'requiere_revision', cumple_umbral: false, requiere_revision: true,
          ultima_evaluacion: evaluacion('2026-10-22T10:00:00.000Z', 0.45, false) }),
        version({ id: 1, version: 'v1' }),
      ],
    })
    const alerta = await screen.findByRole('alert')
    expect(within(alerta).getByText('La versión v2 requiere revisión')).toBeTruthy()
    expect(within(alerta).getByText(/supera el umbral aceptable de 30 %/)).toBeTruthy()
  })

  it('TC-05: compara cada versión con la anterior (mejora/empeora) y señala la mejor', async () => {
    mostrar(dosVersiones)
    await screen.findByText('Comparación entre versiones')
    expect(screen.getByText('Mejor')).toBeTruthy()
    expect(screen.getByText('Mejora')).toBeTruthy() // v2 frente a v1
    expect(screen.getByText('Primera versión')).toBeTruthy()
  })

  it('TC-05: permite elegir dos versiones y ver la comparación', async () => {
    mostrar(dosVersiones)
    await screen.findByText('Comparar dos versiones')
    const [base, nueva] = screen.getAllByRole('combobox').slice(-2)
    await userEvent.selectOptions(base, '1')
    await userEvent.selectOptions(nueva, '2')
    const resultado = await screen.findByRole('status')
    expect(within(resultado).getByText(/v2 frente a v1: mejora/)).toBeTruthy()
    expect(get).toHaveBeenCalledWith('/ml/metricas/comparacion?base=1&nueva=2')
  })

  it('TC-07: muestra el historial de métricas de la versión (entrenamiento y evaluaciones)', async () => {
    mostrar(dosVersiones)
    expect(await screen.findByText('Historial de métricas · v2')).toBeTruthy()
    expect(screen.getByText('Entrenamiento')).toBeTruthy()
    expect(screen.getByText('Evaluación')).toBeTruthy()
  })

  it('TC-07: al elegir otra versión se ve el historial de esa versión', async () => {
    mostrar(dosVersiones)
    await screen.findByText('Historial de métricas · v2')
    await userEvent.selectOptions(screen.getByLabelText('Versión a mostrar'), '1')
    expect(await screen.findByText('Historial de métricas · v1')).toBeTruthy()
  })
})
