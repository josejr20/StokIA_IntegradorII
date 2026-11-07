import { useMemo, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/auth/AuthContext'
import { api } from '@/lib/api'
import UmbralVencimientoSection from './vencimiento/UmbralVencimientoSection'

type Origen = 'producto' | 'global' | 'predeterminado'

interface FilaStock {
  producto_id: number
  codigo: string
  nombre: string
  stock_disponible: number
  stock_minimo: number
  bajo_stock: boolean
  faltante: number
  configurado: boolean
  configuracion_id: number | null
  origen_umbral: Origen
  aviso: string | null
}

interface ResumenStock {
  data: FilaStock[]
  minimo_predeterminado: number
  total: number
  bajo_stock: number
}

interface RespuestaOperacion {
  message?: string
  aviso?: string | null
  evaluacion?: { creadas: number; actualizadas: number; resueltas: number }
}

interface EvaluacionStock {
  creadas: number
  actualizadas: number
  resueltas: number
  correo: {
    intentos: number
    enviados: number
    fallidos: number
    omitidos_preferencia: number
    ya_enviados: number
  }
}

interface PreferenciaEmail {
  id: number
  clave: string
  valor: {
    activo?: boolean
    email?: string
    bajo_stock?: boolean
    riesgo_vencimiento?: boolean
  }
}

type PreferenciaEmailValor = PreferenciaEmail['valor']

function mensajeError(error: unknown) {
  return error instanceof Error ? error.message : 'No se pudo completar la operacion.'
}

const etiquetaOrigen: Record<Origen, string> = {
  producto: 'Personalizado',
  global: 'General',
  predeterminado: 'Predeterminado',
}

function PreferenciasCorreoForm({
  initial,
  emailFallback,
  onSaved,
}: {
  initial?: PreferenciaEmailValor
  emailFallback: string
  onSaved: () => Promise<unknown>
}) {
  const [correo, setCorreo] = useState(initial?.email ?? emailFallback)
  const [activo, setActivo] = useState(initial?.activo ?? false)
  const [bajoStock, setBajoStock] = useState(initial?.bajo_stock ?? true)
  const [vencimientos, setVencimientos] = useState(initial?.riesgo_vencimiento ?? true)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [errorCorreo, setErrorCorreo] = useState('')

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMensaje('')
    setErrorCorreo('')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim())) {
      setErrorCorreo('Ingrese un correo electrónico válido.')
      return
    }

    setGuardando(true)
    try {
      await api.post('/preferencias', {
        clave: 'email_alertas_inventario',
        valor: {
          activo,
          email: correo.trim().toLowerCase(),
          bajo_stock: bajoStock,
          riesgo_vencimiento: vencimientos,
        },
      })
      await onSaved()
      setMensaje('Preferencias de correo guardadas.')
    } catch (error) {
      setErrorCorreo(mensajeError(error))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={(event) => void guardar(event)} className="space-y-4 rounded-xl border bg-card p-5">
      <div>
        <h2 className="text-lg font-semibold">Notificaciones de inventario por correo</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Reciba un correo cuando se genere una alerta nueva. Los avisos en pantalla siguen funcionando independientemente de esta opción.
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={activo} onChange={(event) => setActivo(event.target.checked)} />
        Activar notificaciones por correo
      </label>
      <label className="flex max-w-xl flex-col gap-2 text-sm font-medium">
        Correo destinatario
        <input
          type="email"
          required
          maxLength={254}
          className="w-full rounded-md border bg-background p-3"
          value={correo}
          onChange={(event) => setCorreo(event.target.value)}
        />
      </label>
      <div className="space-y-2">
        <p className="text-sm font-medium">Tipos de alerta</p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={bajoStock} onChange={(event) => setBajoStock(event.target.checked)} />
          Stock por debajo del mínimo
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={vencimientos} onChange={(event) => setVencimientos(event.target.checked)} />
          Riesgo alto o medio de vencimiento
        </label>
      </div>
      {errorCorreo && <p role="alert" className="text-sm text-red-700">{errorCorreo}</p>}
      {mensaje && <p role="status" className="text-sm text-green-700">{mensaje}</p>}
      <button type="submit" disabled={guardando} className="rounded-md bg-green-800 px-4 py-2 font-medium text-white disabled:opacity-50">
        {guardando ? 'Guardando...' : 'Guardar preferencias de correo'}
      </button>
    </form>
  )
}

export default function ConfiguracionPage() {
  const { usuario } = useAuth()
  const [busqueda, setBusqueda] = useState('')
  const [seleccionado, setSeleccionado] = useState('')
  const [minimo, setMinimo] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [exito, setExito] = useState('')
  const [errorFormulario, setErrorFormulario] = useState('')
  const [pagina, setPagina] = useState(1)

  const { data: resumen, isLoading, isError, error: errorCarga, refetch } = useQuery({
    queryKey: ['us24-stock-minimo-resumen'],
    queryFn: () => api.get<ResumenStock>('/umbrales/stock-minimo/resumen'),
  })
  const {
    data: preferenciasEmail,
    isLoading: cargandoPreferencias,
    isError: errorCargaPreferencias,
    error: errorPreferencias,
    refetch: refetchPreferencias,
  } = useQuery({
    queryKey: ['preferencia-email-alertas-inventario', usuario?.id],
    queryFn: () => api.get<{ data: PreferenciaEmail[] }>('/preferencias'),
  })

  const preferenciaEmail = preferenciasEmail?.data.find(
    (preferencia) => preferencia.clave === 'email_alertas_inventario',
  )

  const productosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLocaleLowerCase('es')
    return (resumen?.data ?? []).filter((producto) =>
      !texto || `${producto.codigo} ${producto.nombre}`.toLocaleLowerCase('es').includes(texto),
    )
  }, [resumen, busqueda])

  const filas = productosFiltrados.slice((pagina - 1) * 10, pagina * 10)
  const totalPaginas = Math.max(1, Math.ceil(productosFiltrados.length / 10))
  const elegido = resumen?.data.find((producto) => String(producto.producto_id) === seleccionado)

  function seleccionarProducto(id: string) {
    setSeleccionado(id)
    const producto = resumen?.data.find((item) => String(item.producto_id) === id)
    setMinimo(producto?.configurado ? String(producto.stock_minimo) : '')
    setExito('')
    setErrorFormulario('')
  }

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorFormulario('')
    setExito('')
    if (!seleccionado) return setErrorFormulario('Seleccione un producto.')
    const texto = minimo.trim()
    if (!/^\d+(?:\.\d{1,2})?$/.test(texto) || Number(texto) <= 0 || Number(texto) > 99999999.99) {
      return setErrorFormulario('Ingrese un numero mayor a cero, con hasta dos decimales.')
    }
    setOcupado(true)
    try {
      const respuesta = await api.put<RespuestaOperacion>(
        `/umbrales/stock-minimo/productos/${seleccionado}`,
        { valor: Number(texto) },
      )
      await refetch()
      setExito(`${respuesta.message ?? 'Configuracion guardada.'}${respuesta.aviso ? ` ${respuesta.aviso}` : ''}`)
    } catch (error) {
      setErrorFormulario(mensajeError(error))
    } finally {
      setOcupado(false)
    }
  }

  async function restablecer() {
    if (!elegido?.configurado || ocupado) return
    if (!window.confirm(`¿Restablecer el stock minimo de ${elegido.nombre} al valor general?`)) return
    setErrorFormulario('')
    setExito('')
    setOcupado(true)
    try {
      const respuesta = await api.del<RespuestaOperacion>(
        `/umbrales/stock-minimo/productos/${elegido.producto_id}`,
      )
      await refetch()
      setMinimo('')
      setExito(`${respuesta.message ?? 'Se restablecio el minimo.'}${respuesta.aviso ? ` ${respuesta.aviso}` : ''}`)
    } catch (error) {
      setErrorFormulario(mensajeError(error))
    } finally {
      setOcupado(false)
    }
  }

  async function evaluarTodo() {
    if (ocupado) return
    if (!window.confirm('Esta operacion revisara todos los productos y creara o actualizara alertas en la base de datos compartida. ¿Desea continuar?')) return
    setOcupado(true)
    setExito('')
    setErrorFormulario('')
    try {
      const respuesta = await api.post<{ data: EvaluacionStock }>(
        '/umbrales/stock-minimo/evaluar', {},
      )
      await refetch()
      const { creadas, actualizadas, resueltas, correo } = respuesta.data
      const resultadoCorreo = correo.enviados > 0
        ? ` Se enviaron ${correo.enviados} correos a tu dirección configurada.`
        : correo.fallidos > 0
          ? ' No se pudo enviar el correo por SMTP; revisa la configuración y los registros del servidor.'
          : correo.omitidos_preferencia > 0
            ? ' No se envió correo: activa las notificaciones de stock bajo en tus preferencias.'
            : correo.ya_enviados > 0
              ? ' Las alertas activas ya habían sido enviadas anteriormente a tu correo.'
            : ' No se encontraron alertas activas que notificar.'
      setExito(`Evaluacion terminada: ${creadas} alertas creadas, ${actualizadas} actualizadas y ${resueltas} resueltas.${resultadoCorreo}`)
    } catch (error) {
      setErrorFormulario(mensajeError(error))
    } finally {
      setOcupado(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <div>
        <h1 className="text-2xl font-semibold">Configuración</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          US-24: elija un producto y establezca cuántas unidades deben quedar como mínimo.
        </p>
      </div>

      {isLoading && <p role="status">Cargando productos y existencias...</p>}
      {isError && (
        <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">
          No se pudieron cargar los datos: {mensajeError(errorCarga)}
          <button type="button" className="ml-3 underline" onClick={() => void refetch()}>Reintentar</button>
        </div>
      )}

      {resumen && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border p-4"><p className="text-sm text-muted-foreground">Productos activos</p><p className="text-2xl font-semibold">{resumen.total}</p></div>
            <div className="rounded-xl border p-4"><p className="text-sm text-muted-foreground">Debajo del mínimo</p><p className="text-2xl font-semibold text-red-700">{resumen.bajo_stock}</p></div>
            <div className="rounded-xl border p-4"><p className="text-sm text-muted-foreground">Mínimo general de respaldo</p><p className="text-2xl font-semibold">{resumen.minimo_predeterminado}</p></div>
          </div>

          <form onSubmit={(event) => void guardar(event)} className="space-y-4 rounded-xl border bg-card p-5">
            <h2 className="text-lg font-semibold">Cambiar el mínimo de un producto</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium">
                Producto
                <select required className="w-full rounded-md border bg-background p-3" value={seleccionado} onChange={(event) => seleccionarProducto(event.target.value)}>
                  <option value="">Seleccione un producto</option>
                  {resumen.data.map((producto) => (
                    <option key={producto.producto_id} value={producto.producto_id}>
                      {producto.codigo} - {producto.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Stock mínimo (unidades)
                <input required type="number" min="0.01" max="99999999.99" step="0.01" placeholder="Ejemplo: 10" className="w-full rounded-md border bg-background p-3" value={minimo} onChange={(event) => setMinimo(event.target.value)} />
              </label>
            </div>
            {elegido && (
              <p className="text-sm text-muted-foreground">
                Stock disponible: <strong>{elegido.stock_disponible}</strong>. Mínimo actual: <strong>{elegido.stock_minimo}</strong> ({etiquetaOrigen[elegido.origen_umbral]}).
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <button disabled={ocupado || !seleccionado} className="rounded-md bg-green-800 px-4 py-2 font-medium text-white disabled:opacity-50" type="submit">{ocupado ? 'Procesando...' : 'Guardar mínimo'}</button>
              <button disabled={ocupado || !elegido?.configurado} className="rounded-md border px-4 py-2 disabled:opacity-50" type="button" onClick={() => void restablecer()}>Usar valor por defecto</button>
            </div>
          </form>

          {exito && <p role="status" className="rounded-lg border border-green-300 bg-green-50 p-3 text-green-800">{exito}</p>}
          {errorFormulario && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-red-800">{errorFormulario}</p>}

          <section className="space-y-4 rounded-xl border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Estado de los productos</h2>
                <p className="text-sm text-muted-foreground">Los lotes vencidos y agotados no cuentan como stock disponible.</p>
              </div>
              <button disabled={ocupado} type="button" className="rounded-md border px-4 py-2 disabled:opacity-50" onClick={() => void evaluarTodo()}>
                Evaluar y generar alertas
              </button>
            </div>
            <input aria-label="Buscar producto por nombre o código" placeholder="Buscar producto por nombre o código" className="w-full rounded-md border bg-background p-3" value={busqueda} onChange={(event) => { setBusqueda(event.target.value); setPagina(1) }} />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead><tr className="border-b text-muted-foreground"><th className="p-3">Producto</th><th className="p-3">Disponible</th><th className="p-3">Mínimo</th><th className="p-3">Origen</th><th className="p-3">Resultado</th><th className="p-3">Acción</th></tr></thead>
                <tbody>{filas.map((producto) => (
                  <tr className="border-b" key={producto.producto_id}>
                    <td className="p-3"><strong>{producto.nombre}</strong><span className="block text-xs text-muted-foreground">{producto.codigo}</span></td>
                    <td className="p-3">{producto.stock_disponible}</td>
                    <td className="p-3">{producto.stock_minimo}</td>
                    <td className="p-3">{etiquetaOrigen[producto.origen_umbral]}</td>
                    <td className={`p-3 font-medium ${producto.bajo_stock ? 'text-red-700' : 'text-green-700'}`}>{producto.bajo_stock ? `Stock bajo (faltan ${producto.faltante})` : 'Stock suficiente'}</td>
                    <td className="p-3"><button type="button" className="underline" onClick={() => { seleccionarProducto(String(producto.producto_id)); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Configurar</button></td>
                  </tr>
                ))}</tbody>
              </table>
              {filas.length === 0 && <p className="p-4 text-sm">No se encontraron productos.</p>}
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span>Página {pagina} de {totalPaginas}</span>
              <div className="flex gap-2"><button type="button" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)} className="rounded border px-3 py-2 disabled:opacity-40">Anterior</button><button type="button" disabled={pagina >= totalPaginas} onClick={() => setPagina((p) => p + 1)} className="rounded border px-3 py-2 disabled:opacity-40">Siguiente</button></div>
            </div>
            <p className="text-xs text-muted-foreground">Los productos sin mínimo personalizado usan un valor general o el predeterminado. Solo al guardar o al pulsar «Evaluar y generar alertas» se escriben alertas en la base de datos.</p>
          </section>
        </>
      )}

      <section className="space-y-4">
        {cargandoPreferencias ? (
          <p role="status" className="text-sm text-muted-foreground">Cargando preferencias...</p>
        ) : errorCargaPreferencias ? (
          <div role="alert" className="space-y-2 text-sm text-red-700">
            <p>No se pudieron cargar las preferencias: {mensajeError(errorPreferencias)}</p>
            <button type="button" className="underline" onClick={() => void refetchPreferencias()}>Reintentar</button>
          </div>
        ) : (
          <PreferenciasCorreoForm
            initial={preferenciaEmail?.valor}
            emailFallback={usuario?.email ?? ''}
            onSaved={refetchPreferencias}
          />
        )}
      </section>

      <UmbralVencimientoSection />
    </div>
  )
}