import { api } from '@/lib/api'

export interface ResultadoSimulacion {
    productoId: number
    estado: string
    motivo?: string
    stockActual?: number
    stockMinimo?: number
    demandaEstimada?: number
    horizonteDias?: number
    necesitaReabastecimiento?: boolean
    cantidadSugerida?: number
}

export function simularReabastecimiento(productoId: number) {
    return api.post<{ data: ResultadoSimulacion }>(
        '/ordenes-reabastecimiento/simular',
        { producto_id: productoId }
    )
}