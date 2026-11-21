import { useEffect, useRef, useState } from 'react'
import { useProductos } from '@/features/productos/api'
import { usePredecirDemanda } from '@/features/prediccion/api'
import {
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'

export default function PrediccionesDashboard() {
    const [horizonteDias, setHorizonteDias] = useState(7)
    const [productoId, setProductoId] = useState('')

    const { data, isLoading, isError } = useProductos({
        allPages: true,
    })

    const prediccion = usePredecirDemanda()
    const consultandoRef = useRef(false)
    const productos = data?.results ?? []
    const resultados = prediccion.data?.resultados ?? []

    useEffect(() => {
        if (!productoId) return

        const intervalo = setInterval(async () => {
            if (consultandoRef.current) return

            consultandoRef.current = true

            try {
                await prediccion.mutateAsync({
                    productoIds: [Number(productoId)],
                    horizonteDias,
                })
            } finally {
                consultandoRef.current = false
            }
        }, 30000)

        return () => clearInterval(intervalo)
    }, [productoId, horizonteDias, prediccion.mutateAsync])

    function generarPrediccion() {
        if (!productoId) return

        prediccion.mutate({
            productoIds: [Number(productoId)],
            horizonteDias,
        })
    }

    return (
        <section className="space-y-5 rounded-xl border bg-white p-5">
            <div>
                <h2 className="text-lg font-semibold">
                    Predicciones de demanda
                </h2>
                <p className="text-sm text-muted-foreground">
                    Selecciona un producto para consultar su demanda futura.
                </p>
            </div>

            <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                    <label htmlFor="producto" className="block text-sm">
                        Producto
                    </label>

                    <select
                        id="producto"
                        value={productoId}
                        onChange={(e) => {
                            setProductoId(e.target.value)
                            prediccion.reset()
                        }}
                        className="max-w-xs rounded-lg border px-3 py-2"
                    >
                        <option value="">Seleccionar producto</option>

                        {productos.map((producto) => (
                            <option key={producto.id} value={producto.id}>
                                {producto.nombre}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="space-y-1">
                    <label htmlFor="horizonte" className="block text-sm">
                        Horizonte
                    </label>

                    <select
                        id="horizonte"
                        value={horizonteDias}
                        onChange={(e) => {
                            setHorizonteDias(Number(e.target.value))
                            prediccion.reset()
                        }}
                        className="rounded-lg border px-3 py-2"
                    >
                        <option value={7}>7 días</option>
                        <option value={14}>14 días</option>
                        <option value={30}>30 días</option>
                    </select>
                </div>

                <button
                    type="button"
                    onClick={generarPrediccion}
                    disabled={!productoId || prediccion.isPending}
                    className="rounded-lg bg-emerald-700 px-4 py-2 text-white disabled:opacity-50"
                >
                    {prediccion.isPending
                        ? 'Calculando...'
                        : 'Generar predicción'}
                </button>
            </div>

            {isLoading && <p>Cargando productos...</p>}

            {isError && (
                <p role="alert" className="text-red-600">
                    Error al cargar productos.
                </p>
            )}

            {prediccion.isError && (
                <p role="alert" className="text-red-600">
                    No se pudo generar la predicción.
                </p>
            )}

            {resultados.map((resultado) => (
                <div
                    key={resultado.producto_id}
                    className="rounded-lg border p-4"
                >
                    <h3 className="font-semibold">
                        {resultado.producto?.nombre ?? 'Producto'}
                    </h3>

                    {resultado.estado === 'ok' ? (
                        <>
                            <div className="mt-3 grid gap-4 sm:grid-cols-3">
                                <div>
                                    <p className="text-sm text-muted-foreground">
                                        Demanda estimada
                                    </p>
                                    <p className="text-2xl font-semibold">
                                        {resultado.demanda_estimada} unidades
                                    </p>
                                </div>

                                <div>
                                    <p className="text-sm text-muted-foreground">
                                        Tendencia
                                    </p>
                                    <p className="font-medium">
                                        {resultado.tendencia}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-sm text-muted-foreground">
                                        Confianza
                                    </p>
                                    <p className="font-medium">
                                        {resultado.confianza}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-6">
                                <h4 className="mb-3 font-semibold">
                                    Proyección de demanda por día
                                </h4>

                                {resultado.proyeccion.length > 0 ? (
                                    <div className="h-72 w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={resultado.proyeccion}>
                                                <CartesianGrid strokeDasharray="3 3" />

                                                <XAxis
                                                    dataKey="fecha"
                                                    tickFormatter={(fecha: string) =>
                                                        fecha.slice(5)
                                                    }
                                                />

                                                <YAxis allowDecimals={false} />

                                                <Tooltip />

                                                <Line
                                                    type="monotone"
                                                    dataKey="cantidad"
                                                    name="Demanda prevista"
                                                    stroke="#047857"
                                                    strokeWidth={2}
                                                    dot={{ r: 3 }}
                                                    activeDot={{ r: 5 }}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        No hay datos de proyección disponibles.
                                    </p>
                                )}
                            </div>
                        </>
                    ) : (
                        <p className="mt-2 text-sm text-muted-foreground">
                            {resultado.mensaje}
                        </p>
                    )}
                </div>
            ))}
        </section>
    )
}
