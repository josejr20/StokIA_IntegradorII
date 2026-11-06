import { useState } from 'react'
import { Download, Printer } from 'lucide-react'

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
const ANCHOS_PAPEL: Array<58 | 80> = [80, 58]

const ESTILOS_COMPROBANTE = `
  .receipt {
    box-sizing: border-box;
    width: 100%;
    max-width: __PAPER_WIDTH__;
    margin: 0 auto;
    padding: 20px;
    background: #fff;
    color: #171717;
    font: 12px/1.35 Arial, Helvetica, sans-serif;
  }
  .receipt-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid #222;
  }
  .receipt-logo { width: 42%; max-width: 145px; height: auto; object-fit: contain; }
  .receipt-business { text-align: right; font-size: 10px; font-weight: 700; }
  .receipt-title { margin: 14px 0 2px; text-align: center; font-size: 15px; font-weight: 800; }
  .receipt-number { margin: 0 0 12px; text-align: center; font-size: 12px; font-weight: 700; }
  .receipt-meta { margin-bottom: 12px; font-size: 10px; }
  .receipt-meta p { margin: 3px 0; overflow-wrap: anywhere; }
  .receipt-meta strong { font-weight: 700; }
  .receipt-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 10px; }
  .receipt-table th { padding: 6px 3px; border-top: 1px solid #222; border-bottom: 1px solid #222; text-align: left; }
  .receipt-table td { padding: 6px 3px; vertical-align: top; overflow-wrap: anywhere; }
  .receipt-table .quantity { width: 15%; text-align: right; }
  .receipt-table .description { width: 63%; }
  .receipt-table .amount { width: 22%; text-align: right; white-space: nowrap; }
  .receipt-code { display: block; color: #555; font-size: 9px; }
  .receipt-totals { margin: 10px 0 0 auto; width: 55%; font-size: 11px; }
  .receipt-total-row { display: flex; justify-content: space-between; gap: 8px; padding: 3px 0; }
  .receipt-grand-total { margin-top: 4px; padding-top: 6px; border-top: 1px solid #222; font-size: 13px; font-weight: 800; }
  .receipt-note { margin: 12px 0 0; padding-top: 8px; border-top: 1px dashed #888; font-size: 9px; overflow-wrap: anywhere; }
  .receipt-return { margin-top: 8px; font-size: 9px; }
  .print-area.paper-58mm { width: 58mm; max-width: 100%; }
  .print-area.paper-80mm { width: 80mm; max-width: 100%; }
  @media print {
    @page { margin: 0; }
    body * { visibility: hidden !important; }
    .print-area, .print-area * { visibility: visible !important; }
    .print-area {
      position: fixed !important;
      inset: 0 auto auto 0 !important;
      width: __PAPER_WIDTH__ !important;
      max-width: __PAPER_WIDTH__ !important;
      max-height: none !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: visible !important;
      border: 0 !important;
      border-radius: 0 !important;
      box-shadow: none !important;
    }
    .receipt { max-width: none; padding: 3mm; }
    .receipt-table tr { break-inside: avoid; }
  }
`

function estilosComprobante(anchoPapel: 58 | 80) {
  return ESTILOS_COMPROBANTE.replaceAll('__PAPER_WIDTH__', `${anchoPapel}mm`)
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
  const [anchoPapel, setAnchoPapel] = useState<58 | 80>(80)

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
  const estilosActuales = estilosComprobante(anchoPapel)

  function descargar() {
    const filas = items.map((item, index) => `
      <tr>
        <td class="quantity">${escaparHtml(item.cantidad)}</td>
        <td class="description">${escaparHtml(item.producto)}<span class="receipt-code">${escaparHtml(item.codigo)}</span></td>
        <td class="amount">${formatearMoneda(subtotalesItems[index])}</td>
      </tr>
    `).join('')
    const cliente = normalizados.cliente
      ? `${escaparHtml(normalizados.cliente.nombre)}${normalizados.cliente.documento ? ` · ${escaparHtml(normalizados.cliente.documento)}` : ''}`
      : 'Consumidor final'
    const vendedor = normalizados.vendedor
      ? `${escaparHtml(normalizados.vendedor.nombres)} ${escaparHtml(normalizados.vendedor.apellidos)}`.trim()
      : 'No registrado'
    const logoUrl = new URL('/logo_vlag.png', window.location.origin).href
    const contenido = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Comprobante ${escaparHtml(normalizados.numero_comprobante)}</title>
  <style>
    body { width: ${anchoPapel}mm; max-width: calc(100vw - 32px); margin: 16px auto; padding: 0; background: #f4f4f5; }
    @media print { body { width: ${anchoPapel}mm; max-width: none; margin: 0; } }
    ${estilosActuales}
  </style>
</head>
<body>
  <main class="receipt">
    <header class="receipt-header">
      <img class="receipt-logo" src="${escaparHtml(logoUrl)}" alt="Logo VLAG">
      <div class="receipt-business">StockIA<br>VLAG</div>
    </header>
    <h1 class="receipt-title">${ETIQUETA_TIPO[normalizados.tipo_comprobante] ?? 'COMPROBANTE'}</h1>
    <p class="receipt-number">N° ${escaparHtml(normalizados.numero_comprobante)}</p>
    <section class="receipt-meta">
      <p><strong>Cliente:</strong> ${cliente}</p>
      <p><strong>Fecha:</strong> ${escaparHtml(formatearFecha(normalizados.fecha))}</p>
      <p><strong>Vendedor:</strong> ${vendedor || 'No registrado'}</p>
      <p><strong>Operación:</strong> ${escaparHtml(normalizados.numero_operacion)}</p>
    </section>
    <table class="receipt-table">
      <thead><tr><th class="quantity">Cant.</th><th class="description">Descripción</th><th class="amount">Total</th></tr></thead>
      <tbody>${filas}</tbody>
    </table>
    <section class="receipt-totals">
      <div class="receipt-total-row"><span>Subtotal</span><span>${formatearMoneda(subtotal)}</span></div>
      ${(impuestoPorcentaje ?? 0) > 0 ? `<div class="receipt-total-row"><span>Impuesto (${impuestoPorcentaje}%)</span><span>${formatearMoneda(impuesto)}</span></div>` : ''}
      <div class="receipt-total-row receipt-grand-total"><span>TOTAL</span><span>${formatearMoneda(total)}</span></div>
    </section>
    ${normalizados.motivo ? `<p class="receipt-note"><strong>Motivo:</strong> ${escaparHtml(normalizados.motivo)}</p>` : ''}
    ${normalizados.operacion_origen ? `<p class="receipt-return">Devolución vinculada a la venta ${escaparHtml(normalizados.operacion_origen.numero)} del ${escaparHtml(formatearFecha(normalizados.operacion_origen.fecha))}</p>` : ''}
  </main>
</body>
</html>`
    const blob = new Blob([contenido], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const enlace = document.createElement('a')
    enlace.href = url
    enlace.download = `comprobante-${snapshot.numero}-${anchoPapel}mm.html`
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
        <style>{estilosActuales}</style>
        <div className={`print-area paper-${anchoPapel}mm mx-auto max-h-[70vh] overflow-y-auto rounded-md border bg-zinc-100`}>
          <main className="receipt">
            <header className="receipt-header">
              <img className="receipt-logo" src="/logo_vlag.png" alt="Logo VLAG" />
              <div className="receipt-business">StockIA<br />VLAG</div>
            </header>
            <h2 className="receipt-title">
              {ETIQUETA_TIPO[normalizados.tipo_comprobante] ?? 'COMPROBANTE'}
            </h2>
            <p className="receipt-number">
              N° {normalizados.numero_comprobante || comprobante.numero}
            </p>
            <section className="receipt-meta">
              <p><strong>Cliente:</strong> {normalizados.cliente?.nombre || 'Consumidor final'}</p>
              {normalizados.cliente?.documento && (
                <p><strong>RUC / Documento:</strong> {normalizados.cliente.documento}</p>
              )}
              <p><strong>Fecha:</strong> {formatearFecha(normalizados.fecha)}</p>
              <p><strong>Vendedor:</strong> {normalizados.vendedor
                ? `${normalizados.vendedor.nombres} ${normalizados.vendedor.apellidos}`.trim() || 'No registrado'
                : 'No registrado'}
              </p>
              <p><strong>Operación:</strong> {normalizados.numero_operacion || `OP-${comprobante.operacion_id}`}</p>
            </section>

            <table className="receipt-table">
              <thead>
                <tr>
                  <th className="quantity">Cant.</th>
                  <th className="description">Descripción</th>
                  <th className="amount">Total</th>
                </tr>
              </thead>
              <tbody>
              {items.length > 0 ? items.map((item, index) => (
                <tr key={`${item.producto_id}-${item.lote_id ?? ''}`}>
                  <td className="quantity">{item.cantidad}</td>
                  <td className="description">
                    {item.producto}
                    <span className="receipt-code">{item.codigo}</span>
                  </td>
                  <td className="amount">{formatearMoneda(subtotalesItems[index])}</td>
                </tr>
              )) : (
                <tr>
                  <td className="description" colSpan={3}>
                    No hay productos guardados en este comprobante.
                  </td>
                </tr>
              )}
              </tbody>
            </table>

            <div className="receipt-totals">
              <div className="receipt-total-row">
                <span>Subtotal</span>
                <span>{formatearMoneda(subtotal)}</span>
              </div>
              {(impuestoPorcentaje ?? 0) > 0 && (
                <div className="receipt-total-row">
                  <span>Impuesto ({impuestoPorcentaje}%)</span>
                  <span>{formatearMoneda(impuesto)}</span>
                </div>
              )}
              <div className="receipt-total-row receipt-grand-total">
                <span>TOTAL</span>
                <span>{formatearMoneda(total)}</span>
              </div>
            </div>

            {normalizados.motivo && (
              <p className="receipt-note">
                <strong>Motivo:</strong> {normalizados.motivo}
              </p>
            )}
            {normalizados.operacion_origen && (
              <p className="receipt-return">
                Devolución vinculada a la venta {normalizados.operacion_origen.numero} del{' '}
                {formatearFecha(normalizados.operacion_origen.fecha)}
              </p>
            )}
          </main>
        </div>

        <DialogFooter>
          <div className="flex items-center gap-1" role="group" aria-label="Ancho del papel">
            {ANCHOS_PAPEL.map((ancho) => (
              <Button
                key={ancho}
                type="button"
                variant={anchoPapel === ancho ? 'default' : 'outline'}
                size="sm"
                aria-pressed={anchoPapel === ancho}
                onClick={() => setAnchoPapel(ancho)}
              >
                {ancho} mm
              </Button>
            ))}
          </div>
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
