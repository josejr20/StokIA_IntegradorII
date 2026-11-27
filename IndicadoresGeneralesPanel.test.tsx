// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { IndicadoresGeneralesPanel } from './IndicadoresGeneralesPanel'

/** US-34 · HU-177 QA-01 (frontend): TC-01, 02, 03, 04, 05, 06 y 07 sobre el panel. */
const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: { get: getMock } }))

const base = {
  periodo: { tipo: '90d', desde: '2026-08-29', hasta: '2026-11-26', dias: 90 },
  suficiente: true,
  mensaje: null,
  razones: [],
  rotacion: {
    calculable: true, valor: 3, base: 'valorizado', dias_inventario: 30,
    costo_ventas: 30000, unidades_vendidas: 3000, inventario_promedio_valor: 10000, inventario_promedio_unidades: 1000,
  },
  mermas_evitadas: { calculable: true, unidades: 20, valor: 50, lotes: 1, alertas: 1 },
  metodologia: { rotacion: 'Costo de ventas ÷ inventario promedio.', mermas_evitadas: 'Unidades vendidas tras la alerta.' },
  generado_en: '2026-11-26T15:00:00Z',
}

const insuficiente = {
  ...base,
  suficiente: false,
  mensaje: 'No es posible calcular los indicadores del periodo: no hay datos históricos suficientes.',
  razones: ['Hay 2 día(s) con ventas en el periodo (mínimo 5).'],
  rotacion: { ...base.rotacion, calculable: false, valor: null, dias_inventario: null },
  mermas_evitadas: { ...base.mermas_evitadas, calculable: false },
}

function montar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><IndicadoresGeneralesPanel /></QueryClientProvider>)
}

describe('IndicadoresGeneralesPanel (US-34)', () => {
  beforeEach(() => getMock.mockReset())
  afterEach(() => cleanup())

  it('TC-01/TC-03/TC-04/TC-05: muestra rotación y mermas evitadas del periodo', async () => {
    getMock.mockResolvedValue({ data: base })
    montar()

    const rotacion = await screen.findByTestId('kpi-rotacion')
    expect(rotacion.textContent).toContain('Rotación de inventario')
    expect(rotacion.textContent).toContain('3')
    expect(rotacion.textContent).toContain('cada 30 días')
    const mermas = screen.getByTestId('kpi-mermas')
    expect(mermas.textContent).toContain('20 unidades en 1 lote')
    expect(screen.getByText(/29\/08\/2026 – 26\/11\/2026/)).toBeTruthy()
    expect(getMock).toHaveBeenCalledWith('/reportes/kpis/generales?periodo=90d')
  })

  it('TC-02/TC-07: indica que no es posible calcular cuando faltan datos', async () => {
    getMock.mockResolvedValue({ data: insuficiente })
    montar()

    expect(await screen.findByText(/No es posible calcular los indicadores/)).toBeTruthy()
    expect(screen.getByText(/No hay datos históricos suficientes/)).toBeTruthy()
    expect(screen.getByText(/2 día\(s\) con ventas/)).toBeTruthy()
    expect(screen.queryByTestId('kpi-rotacion')).toBeNull()
    expect(screen.queryByTestId('kpi-mermas')).toBeNull()
  })

  it('TC-06: al cambiar el periodo se vuelve a consultar con ese periodo', async () => {
    getMock.mockResolvedValue({ data: base })
    montar()
    await screen.findByTestId('kpi-rotacion')

    await userEvent.selectOptions(screen.getByLabelText('Periodo'), 'mes_anterior')

    await waitFor(() => expect(getMock).toHaveBeenCalledWith('/reportes/kpis/generales?periodo=mes_anterior'))
  })

  it('TC-06: el periodo personalizado solo consulta con un rango válido', async () => {
    getMock.mockResolvedValue({ data: base })
    montar()
    await screen.findByTestId('kpi-rotacion')
    getMock.mockClear()

    await userEvent.selectOptions(screen.getByLabelText('Periodo'), 'personalizado')
    expect(screen.getByText(/Elige un rango de fechas válido/)).toBeTruthy()
    expect(getMock).not.toHaveBeenCalled()

    await userEvent.type(screen.getByLabelText('Desde'), '2026-01-01')
    await userEvent.type(screen.getByLabelText('Hasta'), '2026-03-31')

    await waitFor(() => expect(getMock).toHaveBeenCalledWith(
      '/reportes/kpis/generales?periodo=personalizado&desde=2026-01-01&hasta=2026-03-31',
    ))
  })

  it('muestra el error del servidor si el periodo es inválido', async () => {
    getMock.mockRejectedValue(new Error('El periodo no puede superar 366 días'))
    montar()
    expect((await screen.findByRole('alert')).textContent).toContain('366 días')
  })
})
