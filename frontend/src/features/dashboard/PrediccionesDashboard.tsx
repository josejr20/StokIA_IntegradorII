import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { RespuestaPrediccion } from '@/features/prediccion/api'
import { api, apiFetch } from '@/lib/api'

import {
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'

const formatoNumero = new Intl.NumberFormat('es-PE', {
    maximumFractionDigits: 2,
})

function formatoFecha(fecha: string) {
    const partes = fecha.split('-')
    return `${partes[2]}/${partes[1]}`
}

export default function PrediccionesDashboard() {
    const [horizonteDias, setHorizonteDias] = useState(7)
    const [productoElegido, setProductoElegido] = useState('')

    const {
        data,
        isLoading,
        isError,
    } = useQuery({
        queryKey: ['us28', 'productos'],
        queryFn: () =>
            apiFetch<{
                data: Array<{
                    id: number
                    nombre: string
                }>
            }>('/predicciones/productos'),
        staleTime: 30_000,
        retry: false,
    })

    const productos = data?.data ?? []

    const productoId = productos.some(
        (producto) => String(producto.id) === productoElegido,
    )
        ? productoElegido
        : String(productos[0]?.id ?? '')

    const prediccion = useQuery({
        queryKey: [
            'dashboard',
            'predicciones',
            productoId,
            horizonteDias,
        ],

        enabled: Boolean(productoId),

        queryFn: async () => {
            const parametros = new URLSearchParams({
                producto_ids: productoId,
                horizonte_dias: String(horizonteDias),
            })

            const respuesta = await api.get<{
                data: RespuestaPrediccion
            }>(`/predicciones/demanda?${parametros.toString()}`)

            return respuesta.data
        },

        refetchInterval: 30000,
        refetchOnWindowFocus: true,
        refetchOnMount: 'always',
        staleTime: 0,
        retry: false,
    })

    const resultado = prediccion.data?.resultados?.find(
        (item) => String(item.producto_id) === productoId,
    )

    const nombreProducto = productos.find(
        (producto) => String(producto.id) === productoId,
    )?.nombre

    function actualizarPrediccion() {
        if (!productoId || prediccion.isFetching) return

        void prediccion.refetch({
            cancelRefetch: false,
        })
    }

    return (
        <section className="space-y-5 rounded-xl border bg-white p-5">

            <div>
                <h2 className="text-lg font-semibold">
                    Predicciones de demanda
                </h2>

                <p className="text-sm text-muted-foreground">
                    Consulta la demanda estimada de los productos
                    para planificar las compras y promociones.
                </p>
            </div>

            <div className="flex flex-wrap items-end gap-3">

                <div className="space-y-1">
                    <label
                        htmlFor="producto-prediccion"
                        className="block text-sm font-medium"
                    >
                        Producto
                    </label>

                    <select
                        id="producto-prediccion"
                        value={productoId}
                        onChange={(e) =>
                            setProductoElegido(e.target.value)
                        }
                        disabled={isLoading || productos.length === 0}
                        className="max-w-xs rounded-lg border px-3 py-2"
                    >
                        {productos.length === 0 && (
                            <option value="">
                                No hay productos disponibles
                            </option>
                        )}

                        {productos.map((producto) => (
                            <option
                                key={producto.id}
                                value={producto.id}
                            >
                                {producto.nombre}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="space-y-1">
                    <label
                        htmlFor="periodo-prediccion"
                        className="block text-sm font-medium"
                    >
                        Periodo de análisis
                    </label>

                    <select
                        id="periodo-prediccion"
                        value={horizonteDias}
                        onChange={(e) =>
                            setHorizonteDias(Number(e.target.value))
                        }
                        className="rounded-lg border px-3 py-2"
                    >
                        <option value={7}>7 días</option>
                        <option value={14}>14 días</option>
                        <option value={30}>30 días</option>
                    </select>
                </div>

                <button
                    type="button"
                    onClick={actualizarPrediccion}
                    disabled={
                        !productoId || prediccion.isFetching
                    }
                    className="rounded-lg bg-emerald-700 px-4 py-2 text-white disabled:opacity-50"
                >
                    {prediccion.isFetching
                        ? 'Actualizando...'
                        : 'Actualizar predicción'}
                </button>
            </div>

            <p className="text-xs text-muted-foreground">
                Actualización automática cada 30 segundos.
            </p>

            {isLoading && (
                <p role="status">
                    Cargando productos...
                </p>
            )}

            {isError && (
                <div
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
                >
                    No se pudo cargar la lista de productos.
                    Comprueba la conexión con el servidor.
                </div>
            )}

            {!isLoading && !isError && productos.length === 0 && (
                <div
                    role="status"
                    className="rounded-lg border bg-gray-50 p-4 text-sm"
                >
                    No hay productos disponibles para consultar
                    predicciones.
                </div>
            )}

            {productoId && prediccion.isLoading && (
                <p role="status">
                    Consultando la predicción de demanda...
                </p>
            )}

            {prediccion.isError && (
                <div
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
                >
                    No se pudo actualizar la predicción.
                    Verifica la conexión con el servidor e inténtalo
                    nuevamente.
                    {resultado && (
                        <p>
                            Se muestra el último resultado disponible.
                        </p>
                    )}
                </div>
            )}

            {prediccion.isSuccess && !resultado && (
                <div
                    role="status"
                    className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
                >
                    No hay predicción disponible para este producto.
                </div>
            )}

            {resultado && (
                <div className="space-y-4 rounded-lg border p-4">

                    <div>
                        <h3 className="font-semibold">
                            {resultado.producto?.nombre ??
                                nombreProducto ??
                                'Producto'}
                        </h3>

                        <p className="text-sm text-muted-foreground">
                            Periodo de {horizonteDias} días
                        </p>
                    </div>

                    {resultado.estado === 'ok' ? (
                        <>
                            <div className="grid gap-4 sm:grid-cols-3">

                                <div className="rounded-lg bg-emerald-50 p-4">
                                    <p className="text-sm text-muted-foreground">
                                        Demanda estimada
                                    </p>

                                    <p className="text-2xl font-semibold text-emerald-700">
                                        {formatoNumero.format(
                                            resultado.demanda_estimada,
                                        )}
                                    </p>

                                    <p className="text-sm">
                                        Unidades
                                    </p>
                                </div>

                                <div className="rounded-lg bg-gray-50 p-4">
                                    <p className="text-sm text-muted-foreground">
                                        Tendencia
                                    </p>

                                    <p className="font-medium capitalize">
                                        {resultado.tendencia}
                                    </p>
                                </div>

                                <div className="rounded-lg bg-gray-50 p-4">
                                    <p className="text-sm text-muted-foreground">
                                        Confianza
                                    </p>

                                    <p className="font-medium capitalize">
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
                                        <ResponsiveContainer
                                            width="100%"
                                            height="100%"
                                        >
                                            <LineChart
                                                data={resultado.proyeccion}
                                            >
                                                <CartesianGrid
                                                    strokeDasharray="3 3"
                                                />

                                                <XAxis
                                                    dataKey="fecha"
                                                    tickFormatter={
                                                        formatoFecha
                                                    }
                                                />

                                                <YAxis />

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
                                    <p className="rounded-lg bg-gray-50 p-4 text-sm">
                                        No hay datos de proyección
                                        disponibles para mostrar el gráfico.
                                    </p>
                                )}
                            </div>
                        </>
                    ) : (
                        <div
                            role="status"
                            className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800"
                        >
                            <p className="font-semibold">
                                No hay predicción disponible
                            </p>

                            <p className="mt-1 text-sm">
                                {resultado.mensaje ||
                                    'El producto no cuenta con información suficiente para generar una predicción.'}
                            </p>
                        </div>
                    )}

                    {prediccion.data?.generado_en && (
                        <p className="text-xs text-muted-foreground">
                            Última consulta:{' '}
                            {new Date(
                                prediccion.data.generado_en,
                            ).toLocaleString('es-PE', {
                                timeZone: 'America/Lima',
                            })}
                        </p>
                    )}
                </div>
            )}
        </section>
    )
}
