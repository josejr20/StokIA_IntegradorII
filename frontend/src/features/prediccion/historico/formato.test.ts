// HU-128 (US-25) · QA-01 — helpers de presentación (TC-04, TC-05 y TC-07 en el cliente).
import { describe, expect, it } from 'vitest'

import type { TotalPeriodo } from './api'
import { datosGrafico, etiquetaPeriodo, fechaCorta, lecturaDiferencia, textoPorcentaje } from './formato'

const periodo = (extra: Partial<TotalPeriodo>): TotalPeriodo => ({
  periodo_inicio: '2026-09-08', periodo_fin: '2026-09-14', prediccion: 80, venta_real: 100,
  diferencia: -20, diferencia_pct: -20, estado: 'ok', mensaje: null, productos_comparados: 1, ...extra,
})

describe('formato', () => {
  it('abrevia fechas sin corrimiento de zona horaria', () => {
    expect(fechaCorta('2026-09-08')).toBe('8 sep')
    expect(fechaCorta('2026-01-01')).toBe('1 ene')
    expect(etiquetaPeriodo('2026-09-08', '2026-09-14')).toBe('8 sep – 14 sep')
    expect(etiquetaPeriodo('2026-09-08', '2026-09-08')).toBe('8 sep')
  })

  it('TC-04: muestra la diferencia porcentual con signo', () => {
    expect(textoPorcentaje(12.5)).toMatch(/^\+12[.,]5 %$/) // es-PE usa punto decimal; se acepta coma por si cambia el ICU
    expect(textoPorcentaje(-8)).toBe('-8 %')
    expect(textoPorcentaje(0)).toBe('0 %')
    expect(textoPorcentaje(null)).toBe('—')
  })

  it('interpreta la diferencia', () => {
    expect(lecturaDiferencia(5)).toBe('Muy cercana')
    expect(lecturaDiferencia(-10)).toBe('Muy cercana')
    expect(lecturaDiferencia(40)).toBe('Sobreestimó')
    expect(lecturaDiferencia(-40)).toBe('Subestimó')
    expect(lecturaDiferencia(null)).toBe('Sin dato')
  })

  it('TC-05 y TC-07: los periodos sin datos quedan como huecos en la gráfica, no como ceros', () => {
    const puntos = datosGrafico([
      periodo({}),
      periodo({ periodo_inicio: '2026-09-15', periodo_fin: '2026-09-21', estado: 'sin_datos', prediccion: null, venta_real: null, diferencia_pct: null }),
    ])
    expect(puntos[0]).toMatchObject({ prediccion: 80, venta_real: 100, sinDatos: false })
    expect(puntos[1]).toMatchObject({ prediccion: null, venta_real: null, sinDatos: true })
  })
})
