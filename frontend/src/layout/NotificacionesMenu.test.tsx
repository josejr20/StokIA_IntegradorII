// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NotificacionesMenu } from './NotificacionesMenu'

// Simulamos un usuario autorizado.
vi.mock('@/auth/AuthContext', () => ({
    useAuth: () => ({
        tienePermiso: (permiso: string) => permiso === 'ver_alertas',
    }),
}))

// Simulamos la respuesta de la API sin conectarnos a Supabase.
vi.mock('@/lib/api', () => ({
    api: {
        get: vi.fn().mockResolvedValue({
            data: [
                {
                    id: 1,
                    tipo: 'bajo_stock',
                    producto_id: 5,
                    mensaje: 'Se generó una orden automática de 25 unidades.',
                    severidad: 'alta',
                    estado: 'nueva',
                    fecha_creacion: '2026-10-24T18:00:00Z',
                },
            ],
        }),
    },
}))

afterEach(() => {
    cleanup()
    vi.clearAllMocks()
})

describe('HU-133 / US-26 - Notificaciones', () => {
    it('TC-06: muestra una alerta de reabastecimiento', async () => {
        render(<NotificacionesMenu />)

        const usuario = userEvent.setup()

        await usuario.click(
            screen.getByRole('button', { name: 'Notificaciones' })
        )

        expect(
            await screen.findByText(
                'Se generó una orden automática de 25 unidades.'
            )
        ).toBeTruthy()
    })
})