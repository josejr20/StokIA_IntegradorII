import { Download, Printer, ReceiptText } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { Comprobante } from '@/types'

const ETIQUETA_TIPO: Record<string, string> = {
  boleta: 'BOLETA DE VENTA',
  factura: 'FACTURA DE VENTA',
  nota_credito: 'NOTA DE CRÉDITO',
}

function numeroFinito(valor: unknown): number | null {
  if (typeof valor !== 'number' && typeof valor !== 'string') return null
  if (typeof valor === 'string' && valor.trim() === '') return null
  const numero = Number(valor)
  return Number.isFinite(numero) ? numero : null
}

function formatearMoneda(valor: unknown) {
  const numero = numeroFinito(valor)
  return numero === null ? 'No disponible' : `S/ ${numero.toFixed(2)}`
}

function formatearFecha(fecha: string | null | undefined) {
  if (!fecha) return 'No disponible'
  const fechaParseada = new Date(fecha)
  if (!Number.isFinite(fechaParseada.getTime())) return 'No disponible'
  return fechaParseada.toLocaleString('es-PE', {
    dateStyle: 'long',
    timeStyle: 'short',
  })
}

function escaparHtml(valor: unknown) {
  return String(valor ?? '\u2014').replace(/[&<>"']/g, (caracter) => {
    const mapa: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return mapa[caracter] ?? caracter
  })
}

/**
 * Normaliza la estructura de datos del comprobante para soportar tanto
 * el formato actual como el formato legado (script de importación antiguo).
 */

interface ComprobanteNormalizado {
  numero_operacion: string
  numero_comprobante: string
  tipo_comprobante: string
  fecha: string
  cliente: { id: number; nombre: string; documento: string | null } | null
  vendedor: { id: number; nombres: string; apellidos: string; email: string } | null
  items: Array<{
    producto_id: number
    codigo: string
    producto: string
    cantidad: number
    precio_unitario: number
    subtotal: number
    lote_id: number | null
  }>
  subtotal: number
  impuesto_porcentaje: number
  impuesto: number
  total: number
  motivo: string | null
  operacion_origen: { id: number; numero: string; fecha: string } | null
}

function normalizarDatosComprobante(datos: Record<string, unknown>, comprobanteNumero?: string): ComprobanteNormalizado {
  // Si ya tiene la estructura nueva, devolver tal cual
  if ('numero_operacion' in datos && 'tipo_comprobante' in datos) {
    return datos as unknown as ComprobanteNormalizado
  }

  // Formato legado del script de importación antiguo
  const operacionLegado = (datos.operacion ?? {}) as Record<string, unknown>
  const clienteLegado = (datos.cliente ?? {}) as Record<string, unknown>
  const usuarioLegado = (datos.usuario ?? {}) as Record<string, unknown>
  const itemsLegado = Array.isArray(datos.items) ? datos.items : []

  return {
    numero_operacion: String(operacionLegado.numero ?? ''),
    numero_comprobante: String(datos.numero_comprobante ?? comprobanteNumero ?? ''),
    tipo_comprobante: String(datos.tipo ?? operacionLegado.tipo ?? 'boleta'),
    fecha: String(operacionLegado.fecha ?? ''),
    cliente: {
      id: Number(clienteLegado.id),
      nombre: String(clienteLegado.nombre ?? '\u2014'),
      documento: clienteLegado.documento ? String(clienteLegado.documento) : null,
    },
    vendedor: {
      id: Number(usuarioLegado.id),
      nombres: String(usuarioLegado.nombres ?? ''),
      apellidos: String(usuarioLegado.apellidos ?? ''),
      email: String(usuarioLegado.email ?? ''),
    },
    items: itemsLegado.map((item: unknown) => {
      const i = item as Record<string, unknown>
      return {
        producto_id: Number(i.producto_id),
        codigo: String(i.codigo ?? i.producto_id ?? ''),
        producto: String(i.producto ?? i.nombre ?? ''),
        cantidad: Number(i.cantidad ?? 0),
        precio_unitario: Number(i.precio_unitario ?? 0),
        subtotal: Number(i.subtotal ?? 0),
        lote_id: i.lote_id ? Number(i.lote_id) : null,
      }
    }),
    subtotal: Number(datos.subtotal ?? 0),
    impuesto_porcentaje: Number(datos.impuesto_porcentaje ?? 0),
    impuesto: Number(datos.impuesto ?? 0),
    total: Number(datos.total ?? 0),
    motivo: operacionLegado.motivo ? String(operacionLegado.motivo) : datos.motivo ? String(datos.motivo) : null,
    operacion_origen: datos.operacion_origen as { id: number; numero: string; fecha: string } | null,
  }
}

/**
 * Vista previa del comprobante generado al confirmar una venta o devolución.
 * El snapshot viene congelado del backend, así que se puede ver, descargar
 * e imprimir después aunque el producto o el cliente cambien.
 */
export function ComprobanteModal({
  comprobante,
  onCerrar,
}: {
  comprobante: Comprobante | null
  onCerrar: () => void
}) {
  if (!comprobante) return null
  const datos = comprobante.datos
  if (!datos || typeof datos !== 'object') {
    return (
      <Dialog open onOpenChange={(abierto) => !abierto && onCerrar()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Comprobante no disponible</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Este comprobante no contiene información válida para mostrar.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={onCerrar}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // Normalize legacy data structure (from old import script) to current format
  const normalizados = normalizarDatosComprobante(datos, comprobante.numero)

  const snapshot = comprobante
  const items = Array.isArray(normalizados.items)
    ? normalizados.items.filter((item) => item && typeof item === 'object')
    : []
  const subtotalesItems = items.map((item) => {
    const subtotal = numeroFinito(item.subtotal)
    if (subtotal !== null) return subtotal
    const cantidad = numeroFinito(item.cantidad)
    const precio = numeroFinito(item.precio_unitario)
    return cantidad !== null && precio !== null ? cantidad * precio : null
  })
  const subtotalCalculado = items.length > 0 && subtotalesItems.every((subtotalItem) => subtotalItem !== null)
    ? subtotalesItems.reduce<number>((total, subtotalItem) => total + (subtotalItem ?? 0), 0)
    : null
  const subtotal = numeroFinito(normalizados.subtotal) ?? subtotalCalculado
  const impuestoPorcentaje = numeroFinito(normalizados.impuesto_porcentaje)
  const impuesto = numeroFinito(normalizados.impuesto)
    ?? (subtotal !== null && impuestoPorcentaje !== null
      ? subtotal * impuestoPorcentaje / 100
      : null)
  const total = numeroFinito(normalizados.total)
    ?? (subtotal !== null ? subtotal + (impuesto ?? 0) : null)

  function descargar() {
    const filas = items.map((item, index) => `
      <tr>
        <td>${escaparHtml(item.codigo)}</td>
        <td>${escaparHtml(item.producto)}</td>
        <td class="numero">${escaparHtml(item.cantidad)}</td>
        <td class="numero">${formatearMoneda(item.precio_unitario)}</td>
        <td class="numero">${formatearMoneda(subtotalesItems[index])}</td>
      </tr>
    `).join('')
    const cliente = normalizados.cliente
      ? `${escaparHtml(normalizados.cliente.nombre)}${normalizados.cliente.documento ? ` · ${escaparHtml(normalizados.cliente.documento)}` : ''}`
      : 'Consumidor final'
    const vendedor = normalizados.vendedor
      ? `${escaparHtml(normalizados.vendedor.nombres)} ${escaparHtml(normalizados.vendedor.apellidos)}`
      : 'No registrado'
    const contenido = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Comprobante ${escaparHtml(normalizados.numero_comprobante)}</title>
  <style>
    body { color: #171717; font: 14px Arial, sans-serif; margin: 32px auto; max-width: 800px; padding: 0 24px; }
    header { border-bottom: 2px solid #222; margin-bottom: 24px; padding-bottom: 16px; }
    h1 { font-size: 22px; margin: 8px 0; }
    .muted { color: #666; }
    .datos { display: flex; justify-content: space-between; gap: 24px; margin: 24px 0; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border-bottom: 1px solid #ddd; padding: 10px 6px; text-align: left; }
    th { color: #555; font-size: 12px; text-transform: uppercase; }
    .numero { text-align: right; white-space: nowrap; }
    .totales { margin: 20px 0 20px auto; width: 260px; }
    .total { border-top: 2px solid #222; font-size: 18px; font-weight: bold; margin-top: 8px; padding-top: 8px; }
    .motivo { background: #f4f4f5; margin-top: 24px; padding: 12px; }
    @media print { body { margin: 0; max-width: none; } }
  </style>
</head>
<body>
  <header>
    <div class="muted">StockIA — VLAG</div>
    <h1>${ETIQUETA_TIPO[normalizados.tipo_comprobante] ?? 'COMPROBANTE'}</h1>
    <strong>N° ${escaparHtml(normalizados.numero_comprobante)}</strong>
    <span class="muted"> · Operación ${escaparHtml(normalizados.numero_operacion)}</span>
  </header>
  <section class="datos">
    <div><div class="muted">Cliente</div><strong>${cliente}</strong></div>
    <div><div class="muted">Fecha y hora</div><strong>${escaparHtml(formatearFecha(normalizados.fecha))}</strong><br><span class="muted">Vendedor: ${vendedor}</span></div>
  </section>
  <table>
    <thead><tr><th>Código</th><th>Producto</th><th class="numero">Cantidad</th><th class="numero">P. unitario</th><th class="numero">Subtotal</th></tr></thead>
    <tbody>${filas}</tbody>
  </table>
  <section class="totales">
    <div>Subtotal <span class="numero">${formatearMoneda(subtotal)}</span></div>
    ${(impuestoPorcentaje ?? 0) > 0 ? `<div>Impuesto (${impuestoPorcentaje}%) <span class="numero">${formatearMoneda(impuesto)}</span></div>` : ''}
    <div class="total">Total <span class="numero">${formatearMoneda(total)}</span></div>
  </section>
  ${normalizados.motivo ? `<p class="motivo"><strong>Motivo:</strong> ${escaparHtml(normalizados.motivo)}</p>` : ''}
  ${normalizados.operacion_origen ? `<p class="muted">Devolución vinculada a la venta ${escaparHtml(normalizados.operacion_origen.numero)} del ${escaparHtml(formatearFecha(normalizados.operacion_origen.fecha))}</p>` : ''}
</body>
</html>`
    const blob = new Blob([contenido], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = `comprobante-${snapshot.numero}.html`
    enlace.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <Dialog open={Boolean(comprobante)} onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Comprobante {comprobante.numero}</DialogTitle>
        </DialogHeader>

        {/* Área que se imprime */}
        <div className="print-area max-h-[70vh] overflow-y-auto rounded-md border p-6">
          <div className="flex items-start justify-between border-b pb-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                StockIA — VLAG
              </p>
              <h2 className="text-xl font-bold">
                {ETIQUETA_TIPO[normalizados.tipo_comprobante] ?? 'COMPROBANTE'}
              </h2>
              <p className="text-sm font-medium">
                N° {normalizados.numero_comprobante || comprobante.numero}
                <span className="ml-2 text-muted-foreground">
                  (Operación {normalizados.numero_operacion || `OP-${comprobante.operacion_id}`})
                </span>
              </p>
            </div>
            <ReceiptText className="size-10 text-primary" />
          </div>

          <div className="grid grid-cols-2 gap-4 py-4 text-sm">
            <div>
              <p className="text-xs uppercase text-muted-foreground">Cliente</p>
              <p className="font-medium">{normalizados.cliente?.nombre || 'Consumidor final'}</p>
              {normalizados.cliente?.documento && (
                <p className="text-muted-foreground">{normalizados.cliente.documento}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs uppercase text-muted-foreground">Fecha y hora</p>
              <p className="font-medium">{formatearFecha(normalizados.fecha)}</p>
              <p className="text-muted-foreground">
                Vendedor: {normalizados.vendedor
                  ? `${normalizados.vendedor.nombres} ${normalizados.vendedor.apellidos}`.trim() || 'No registrado'
                  : 'No registrado'}
              </p>
            </div>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-2">Código</th>
                <th className="py-2 pr-2">Producto</th>
                <th className="py-2 pr-2 text-right">Cantidad</th>
                <th className="py-2 pr-2 text-right">P. unitario</th>
                <th className="py-2 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.length > 0 ? items.map((item, index) => (
                <tr key={`${item.producto_id}-${item.lote_id ?? ''}`}>
                  <td className="py-2 pr-2 font-mono text-xs">{item.codigo}</td>
                  <td className="py-2 pr-2">{item.producto}</td>
                  <td className="py-2 pr-2 text-right">{item.cantidad}</td>
                  <td className="py-2 pr-2 text-right">{formatearMoneda(item.precio_unitario)}</td>
                  <td className="py-2 text-right">{formatearMoneda(subtotalesItems[index])}</td>
                </tr>
              )) : (
                <tr>
                  <td className="py-3 text-center text-muted-foreground" colSpan={5}>
                    No hay productos guardados en este comprobante.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="flex justify-end py-4">
            <div className="w-56 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatearMoneda(subtotal)}</span>
              </div>
              {(impuestoPorcentaje ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Impuesto ({impuestoPorcentaje}%)
                  </span>
                  <span>{formatearMoneda(impuesto)}</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-1 text-base font-bold">
                <span>Total</span>
                <span>{formatearMoneda(total)}</span>
              </div>
            </div>
          </div>

          {normalizados.motivo && (
            <p className="rounded-md bg-muted p-3 text-sm">
              <span className="font-medium">Motivo: </span>
              {normalizados.motivo}
            </p>
          )}
          {normalizados.operacion_origen && (
            <p className="mt-2 text-xs text-muted-foreground">
              Devolución vinculada a la venta {normalizados.operacion_origen.numero} del{' '}
              {formatearFecha(normalizados.operacion_origen.fecha)}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={descargar}>
            <Download className="size-4" />
            Descargar comprobante
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="size-4" />
            Imprimir / Guardar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
