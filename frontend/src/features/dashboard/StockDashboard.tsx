
import { useMemo } from 'react'
import { useLotes } from '@/features/inventario/api'
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts'

export default function StockDashboard() {
    const { data, isLoading, isError } = useLotes()
    const lotes = data?.results ?? []

    const resumen = useMemo(() => {
        const productos = new Map<
            number,
            { nombre: string; stock: number; lotes: number }
        >()

        for (const lote of lotes) {
            const actual = productos.get(lote.producto_id)

            if (actual) {
                actual.stock += Number(lote.cantidad_actual)
                actual.lotes++
            } else {
                productos.set(lote.producto_id, {
                    nombre: lote.producto_nombre,
                    stock: Number(lote.cantidad_actual),
                    lotes: 1,
                })
            }
        }

        return Array.from(productos.values())
            .sort((a, b) => a.stock - b.stock)
            .slice(0, 10)
    }, [lotes])

    return (
        <section className="space-y-4 rounded-xl border bg-white p-5">
            <div>
                <h2 className="text-lg font-semibold">
                    Niveles de stock
                </h2>
                <p className="text-sm text-muted-foreground">
                    Los 10 productos con menor existencia registrada.
                </p>
            </div>

            {isLoading && <p>Cargando inventario...</p>}

            {isError && (
                <p role="alert" className="text-red-600">
                    No se pudo cargar el inventario.
                </p>
            )}

            {!isLoading && !isError && resumen.length === 0 && (
                <p className="text-sm text-muted-foreground">
                    No hay lotes registrados.
                </p>
            )}

            {resumen.length > 0 && (
                <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={resumen}
                            layout="vertical"
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                            <XAxis type="number" allowDecimals={false} />
                            <YAxis
                                type="category"
                                dataKey="nombre"
                                width={180}
                                tick={{ fontSize: 11 }}
                                tickFormatter={(nombre: string) =>
                                    nombre.length > 25 ? `${nombre.slice(0, 25)}...` : nombre
                                }
                            />
                            <Tooltip />
                            <Bar
                                dataKey="stock"
                                name="Unidades disponibles"
                                fill="#047857"
                                radius={[0, 4, 4, 0]}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {resumen.length > 0 && (
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b">
                                <th className="p-3">Producto</th>
                                <th className="p-3">Stock</th>
                                <th className="p-3">Lotes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {resumen.map((producto) => (
                                <tr key={producto.nombre} className="border-b">
                                    <td className="p-3">{producto.nombre}</td>
                                    <td className="p-3 font-semibold">
                                        {producto.stock}
                                    </td>
                                    <td className="p-3">{producto.lotes}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    )
}
