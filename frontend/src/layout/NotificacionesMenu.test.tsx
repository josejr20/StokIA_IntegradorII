
 // @vitest-environment jsdom

import {
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import {
  cleanup,
  render,
  screen,
} from '@testing-library/react'

import userEvent from '@testing-library/user-event'

import { NotificacionesMenu } from './NotificacionesMenu'

// Simulamos la API sin modificar la base de datos.
const { obtenerAlertasMock } = vi.hoisted(() => ({
  obtenerAlertasMock: vi.fn(),
}))

// Simulamos un usuario con permiso para ver alertas.
vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({
    tienePermiso: (permiso: string) =>
      permiso === 'ver_alertas',
  }),
}))

vi.mock('@/lib/api', () => ({
  api: {
    get: obtenerAlertasMock,
  },
}))

interface AlertaPrueba {
  id: number
  tipo: string
  producto_id: number
  mensaje: string
  severidad: string
  estado: string
  fecha_creacion: string
}

// Crea datos de ejemplo para cada prueba.
function crearAlerta(
  cambios: Partial<AlertaPrueba> = {}
): AlertaPrueba {
  return {
    id: 1,
    tipo: 'bajo_stock',
    producto_id: 5,
    mensaje: 'Se generó una orden automática de 25 unidades.',
    severidad: 'alta',
    estado: 'nueva',
    fecha_creacion: '2026-11-04T18:00:00Z',
    ...cambios,
  }
}

beforeEach(() => {
  obtenerAlertasMock.mockResolvedValue({
    data: [],
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('HU-133 / US-26 y US-22 - Notificaciones', () => {

  // PRUEBA 1: Funcionalidad original de bajo stock.
  it('TC-06: muestra una alerta de reabastecimiento', async () => {
    obtenerAlertasMock.mockResolvedValue({
      data: [crearAlerta()],
    })

    render(<NotificacionesMenu />)

    const usuario = userEvent.setup()

    await usuario.click(
      screen.getByRole('button', {
        name: 'Notificaciones',
      })
    )

    expect(
      await screen.findByText(
        'Se generó una orden automática de 25 unidades.'
      )
    ).toBeTruthy()
  })

  // PRUEBA 2: Mostrar una anomalía detectada.
  it('US-22: muestra una anomalía de ventas', async () => {
    obtenerAlertasMock.mockResolvedValue({
      data: [
        crearAlerta({
          id: 2,
          tipo: 'anomalia',
          producto_id: 10,
          mensaje: 'Venta inusual detectada: 150 unidades.',
          severidad: 'alta',
        }),
      ],
    })

    render(<NotificacionesMenu />)

    const usuario = userEvent.setup()

    await usuario.click(
      screen.getByRole('button', {
        name: 'Notificaciones',
      })
    )

    expect(
      await screen.findByText(
        'Venta inusual detectada: 150 unidades.'
      )
    ).toBeTruthy()

    expect(
      screen.getByText('Anomalía detectada')
    ).toBeTruthy()

    expect(
      screen.getByText('Producto #10')
    ).toBeTruthy()
  })

  // PRUEBA 3: Mostrar ambas clases de alertas.
  it('US-22: muestra bajo stock y anomalías juntas', async () => {
    obtenerAlertasMock.mockResolvedValue({
      data: [
        crearAlerta(),
        crearAlerta({
          id: 2,
          tipo: 'anomalia',
          producto_id: 10,
          mensaje: 'Movimiento de inventario inusual.',
        }),
      ],
    })

    render(<NotificacionesMenu />)

    const usuario = userEvent.setup()

    await usuario.click(
      screen.getByRole('button', {
        name: 'Notificaciones',
      })
    )

    expect(
      await screen.findByText(
        'Movimiento de inventario inusual.'
      )
    ).toBeTruthy()

    expect(
      screen.getByText(
        'Se generó una orden automática de 25 unidades.'
      )
    ).toBeTruthy()

    // La campanita debe mostrar dos pendientes.
    expect(
      screen.getByText('2')
    ).toBeTruthy()
  })

  // PRUEBA 4: Ignorar alertas que no están pendientes.
  it('US-22: no muestra alertas atendidas o descartadas', async () => {
    obtenerAlertasMock.mockResolvedValue({
      data: [
        crearAlerta({
          id: 3,
          tipo: 'anomalia',
          estado: 'atendida',
          mensaje: 'Anomalía ya atendida.',
        }),
        crearAlerta({
          id: 4,
          tipo: 'anomalia',
          estado: 'descartada',
          mensaje: 'Anomalía descartada.',
        }),
      ],
    })

    render(<NotificacionesMenu />)

    const usuario = userEvent.setup()

    await usuario.click(
      screen.getByRole('button', {
        name: 'Notificaciones',
      })
    )

    expect(
      await screen.findByText(
        'No hay notificaciones pendientes.'
      )
    ).toBeTruthy()

    expect(
      screen.queryByText('Anomalía ya atendida.')
    ).toBeNull()

    expect(
      screen.queryByText('Anomalía descartada.')
    ).toBeNull()
  })

  // PRUEBA 5: Lista vacía.
  it('US-22: no muestra alertas cuando no existen', async () => {
    obtenerAlertasMock.mockResolvedValue({
      data: [],
    })

    render(<NotificacionesMenu />)

    const usuario = userEvent.setup()

    await usuario.click(
      screen.getByRole('button', {
        name: 'Notificaciones',
      })
    )

    expect(
      await screen.findByText(
        'No hay notificaciones pendientes.'
      )
    ).toBeTruthy()

    expect(
      obtenerAlertasMock
    ).toHaveBeenCalledWith('/alertas')
  })

})
