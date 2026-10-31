import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useClientes } from '../api'
import type { Cliente } from '@/types'

interface ClienteComboboxProps {
  valor: Cliente | null
  onCambio: (cliente: Cliente | null) => void
  placeholder?: string
  obligatorio?: boolean
  disabled?: boolean
}

/**
 * Selector de cliente con búsqueda por nombre o documento.
 * Los 564 clientes se filtran en el servidor mientras se escribe.
 */
export function ClienteCombobox({
  valor,
  onCambio,
  placeholder = 'Buscar cliente por nombre o documento...',
  obligatorio = false,
  disabled = false,
}: ClienteComboboxProps) {
  const [buscar, setBuscar] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [debounce, setDebounce] = useState('')
  const contenedorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const temporizador = setTimeout(() => setDebounce(buscar), 250)
    return () => clearTimeout(temporizador)
  }, [buscar])

  const { data: clientes, isLoading } = useClientes(debounce)

  useEffect(() => {
    function alHacerClic(evento: MouseEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(evento.target as Node)) {
        setAbierto(false)
      }
    }
    document.addEventListener('mousedown', alHacerClic)
    return () => document.removeEventListener('mousedown', alHacerClic)
  }, [])

  function seleccionar(cliente: Cliente) {
    onCambio(cliente)
    setBuscar('')
    setAbierto(false)
  }

  return (
    <div ref={contenedorRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={abierto ? buscar : valor ? valor.nombre : buscar}
          placeholder={valor && !abierto ? valor.nombre : placeholder}
          onChange={(evento) => {
            if (disabled) return
            setBuscar(evento.target.value)
            setAbierto(true)
          }}
          onFocus={() => {
            if (!disabled) setAbierto(true)
          }}
          onKeyDown={(evento) => {
            if (evento.key === 'Enter' && clientes?.length) {
              evento.preventDefault()
              seleccionar(clientes[0])
            }
            if (evento.key === 'Escape') {
              setAbierto(false)
              setBuscar('')
            }
          }}
          className={cn('pl-9', obligatorio && !valor && 'border-destructive/60')}
          aria-label="Cliente"
          disabled={disabled}
        />
        {valor && !abierto && !disabled && (
          <button
            type="button"
            onClick={() => {
              onCambio(null)
              setBuscar('')
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Quitar cliente"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {abierto && !disabled && (
        <div className="absolute z-40 mt-1 w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="max-h-60 overflow-y-auto p-1">
            {isLoading && (
              <p className="px-2 py-1.5 text-sm text-muted-foreground">Buscando...</p>
            )}
            {!isLoading && clientes && clientes.length === 0 && (
              <p className="px-2 py-1.5 text-sm text-muted-foreground">
                No hay clientes que coincidan.
              </p>
            )}
            {!isLoading &&
              clientes?.map((cliente) => (
                <button
                  key={cliente.id}
                  type="button"
                  onClick={() => seleccionar(cliente)}
                  className={cn(
                    'flex w-full cursor-pointer flex-col rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-muted',
                    valor?.id === cliente.id && 'bg-muted',
                  )}
                >
                  <span className="truncate font-medium">{cliente.nombre}</span>
                  {cliente.documento && (
                    <span className="text-xs text-muted-foreground">{cliente.documento}</span>
                  )}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
