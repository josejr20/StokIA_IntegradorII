// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { AlertasVencimientoPanel } from './AlertasVencimientoPanel'

/**
 * US-29 · HU-151 QA-01 (parte frontend): TC-01 a TC-07 sobre el panel del dashboard.
 * La API y el WebSocket se simulan; no se toca la base de datos.
 */
const { getMock, postMock } = vi.hoisted(() => ({ getMock: vi.fn(), postMock: vi.fn() }))

vi.mock('@/lib/api', () => ({
  api: { get: getMock, post: postMock },
  ApiError: class ApiError extends Error {},
}))
vi.mock('@/lib/socket', () => ({ useAlertasVencimientoRealtime: () => undefined }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

function alerta(cambios = {}) {
  return {
    id: 1,
    severidad: 'alta',
    estado: 'nueva',
    producto: { id: 4, codigo: 'P-004', nombre: 'Leche entera 1L' },
    lote: { id: 12, numero: 'L-12' },
    motivo: 'Riesgo alto: 15 de 20 unidades no se venderían antes de vencer',
    factores: [],
    fecha_vencimiento: '2026-12-01',
    dias_para_vencer: 5,
    stock: 20,
    unidades_en_riesgo: 15,
    porcentaje_en_riesgo: 75,
    fecha_creacion: '2026-11-26T10:00:00Z',
    ...cambios,
  }
}

function respuesta(alertas: ReturnType<typeof alerta>[]) {
  return {
    data: {
      alertas,
      total: alertas.length,
      hay_alertas: alertas.length > 0,
      sincronizado: true,
      actualizado_en: '2026-11-26T10:00:00Z',
    },
  }
}

function montar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AlertasVencimientoPanel />
    </QueryClientProvider>,
  )
}

describe('AlertasVencimientoPanel (US-29)', () => {
  beforeEach(() => { getMock.mockReset(); postMock.mockReset() })
  afterEach(() => cleanup())

  it('TC-01/TC-03/TC-04: muestra destacadas las alertas con producto, lote y motivo', async () => {
    getMock.mockResolvedValue(respuesta([alerta()]))
    montar()

    expect(await screen.findByText('Leche entera 1L')).toBeTruthy()
    expect(screen.getByText('L-12')).toBeTruthy()
    expect(screen.getByText(/15 de 20 unidades/)).toBeTruthy()
    expect(screen.getByText('Riesgo alto')).toBeTruthy()
    expect(screen.queryByText(/No hay alertas activas/)).toBeNull()
  })

  it('TC-02/TC-07: indica que no hay alertas activas', async () => {
    getMock.mockResolvedValue(respuesta([]))
    montar()
    expect(await screen.findByText('No hay alertas activas de riesgo de vencimiento.')).toBeTruthy()
    expect(screen.queryByTestId('alerta-vencimiento')).toBeNull()
  })

  it('TC-05/TC-06: marcar como atendida quita la alerta y muestra el estado vacío', async () => {
    getMock.mockResolvedValueOnce(respuesta([alerta()])).mockResolvedValue(respuesta([]))
    postMock.mockResolvedValue({ data: {} })
    montar()

    await userEvent.click(await screen.findByRole('button', { name: /marcar como atendida/i }))

    expect(postMock).toHaveBeenCalledWith('/alertas/1/atender')
    await waitFor(() => expect(screen.queryByTestId('alerta-vencimiento')).toBeNull())
    expect(await screen.findByText(/No hay alertas activas/)).toBeTruthy()
  })

  it('TC-05: si el servidor falla, la alerta vuelve a mostrarse', async () => {
    getMock.mockResolvedValue(respuesta([alerta()]))
    postMock.mockRejectedValue(new Error('fallo'))
    montar()

    await userEvent.click(await screen.findByRole('button', { name: /marcar como atendida/i }))
    expect(await screen.findByTestId('alerta-vencimiento')).toBeTruthy()
  })
})
