
import { useState } from 'react'
import { ClipboardList } from 'lucide-react'
import { toast } from 'sonner'

import { useProductos } from '@/features/productos/api'
import {
    simularReabastecimiento,
    type ResultadoSimulacion,
} from './api'

export default function ReabastecimientoPage() {
    const [productoId, setProductoId] = useState('')
    const [simulando, setSimulando] = useState(false)
    const [resultado, setResultado] = useState<ResultadoSimulacion | null>(null)

    const { data: productos, isLoading } = useProductos({})

    async function ejecutarSimulacion() {
        if (!productoId) {
            toast.error('Selecciona un producto primero')
            return
        }

        setSimulando(true)
        setResultado(null)

        try {
            const respuesta = await simularReabastecimiento(Number(productoId))
            setResultado(respuesta.data)
            toast.success('Simulación completada')
        } catch {
            toast.error('No se pudo ejecutar la simulación')
        } finally {
            setSimulando(false)
        }
    }

    return (
        <div className="space-y-6 p-6">
            {/* Encabezado */}
            <div className="flex items-center gap-3">
                <ClipboardList className="size-8 text-primary" />

                <div>
                    <h1 className="text-2xl font-bold">
                        Reabastecimiento
                    </h1>

                    <p className="text-sm text-muted-foreground">
                        Evaluación de inventario y generación automática
                        de órdenes de reabastecimiento.
                    </p>
                </div>
            </div>

            {/* Tarjeta de simulación */}
            <div className="rounded-lg border bg-card p-6">
                <h2 className="text-lg font-semibold">
                    Simulación de reabastecimiento
                </h2>

                <p className="mt-2 text-sm text-muted-foreground">
                    Selecciona un producto y evalúa si necesita
                    reabastecimiento, sin generar órdenes reales.
                </p>

                {/* Selector de productos */}
                <div className="mt-5 space-y-2">
                    <label
                        htmlFor="producto-reabastecimiento"
                        className="text-sm font-medium"
                    >
                        Seleccionar producto
                    </label>

                    <select
                        id="producto-reabastecimiento"
                        value={productoId}
                        onChange={(e) => {
                            setProductoId(e.target.value)
                            setResultado(null)
                        }}
                        disabled={isLoading || simulando}
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    >
                        <option value="">
                            {isLoading
                                ? 'Cargando productos...'
                                : 'Seleccione un producto'}
                        </option>

                        {(productos?.results ?? []).map((producto) => (
                            <option key={producto.id} value={producto.id}>
                                {producto.codigo} — {producto.nombre}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Botón de simulación */}
                <button
                    type="button"
                    onClick={ejecutarSimulacion}
                    disabled={!productoId || simulando}
                    className="mt-4 rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                    {simulando
                        ? 'Evaluando producto...'
                        : 'Simular reabastecimiento'}
                </button>

                {/* Resultado de la simulación */}
                {resultado && (
                    <div className="mt-6 rounded-lg border bg-muted/30 p-5">
                        <h3 className="mb-4 text-lg font-semibold">
                            Resultado de la simulación
                        </h3>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <p>
                                <strong>Estado:</strong> {resultado.estado}
                            </p>

                            <p>
                                <strong>Stock actual:</strong>{' '}
                                {resultado.stockActual ?? 'No disponible'}
                            </p>

                            <p>
                                <strong>Stock mínimo:</strong>{' '}
                                {resultado.stockMinimo ?? 'No disponible'}
                            </p>

                            <p>
                                <strong>Demanda estimada:</strong>{' '}
                                {resultado.demandaEstimada ?? 'No disponible'}
                            </p>

                            <p>
                                <strong>Cantidad sugerida:</strong>{' '}
                                {resultado.cantidadSugerida ?? 'No disponible'}
                            </p>

                            <p>
                                <strong>Motivo:</strong>{' '}
                                {resultado.motivo ?? 'Sin observaciones'}
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
