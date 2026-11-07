// HU-118 (US-23) · QA-01 — validación del formulario (TC-02 y TC-05), lado cliente.
import { describe, expect, it } from 'vitest'

import { errorUmbralDias, textoDias } from './validacion'

describe('errorUmbralDias', () => {
  it.each(['-5', '0', '2.5', 'abc', '', '   ', '1e2', '3651'])('rechaza %j', (valor) => {
    expect(errorUmbralDias(valor)).not.toBeNull()
  })

  it.each(['1', '30', ' 45 ', '3650', '10.0'])('acepta %j', (valor) => {
    expect(errorUmbralDias(valor)).toBeNull()
  })

  it('explica el motivo del rechazo', () => {
    expect(errorUmbralDias('-3')).toMatch(/mayor a cero/)
    expect(errorUmbralDias('abc')).toMatch(/numérico/)
    expect(errorUmbralDias('')).toMatch(/Ingrese/)
  })
})

describe('textoDias', () => {
  it('usa singular y plural', () => {
    expect(textoDias(1)).toBe('1 día')
    expect(textoDias(30)).toBe('30 días')
  })
})
