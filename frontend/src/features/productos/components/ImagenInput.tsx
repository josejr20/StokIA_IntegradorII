import { useRef, useState } from 'react'
import { ImageIcon, Upload } from 'lucide-react'

import { Button } from '@/components/ui/button'

/** Selector de imagen con vista previa, para el catálogo de productos. */
export function ImagenInput({
  imagenActual,
  onChange,
}: {
  imagenActual?: string | null
  onChange: (archivo: File | null) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [previa, setPrevia] = useState<string | null>(null)

  function manejarSeleccion(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0] ?? null
    onChange(archivo)
    setPrevia(archivo ? URL.createObjectURL(archivo) : null)
  }

  const mostrar = previa ?? imagenActual

  return (
    <div className="flex items-center gap-3">
      <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted">
        {mostrar ? (
          <img src={mostrar} alt="Vista previa" className="size-full object-cover" />
        ) : (
          <ImageIcon className="size-6 text-muted-foreground" />
        )}
      </div>
      <div>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={manejarSeleccion} />
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
          <Upload className="size-3.5" /> {mostrar ? 'Cambiar imagen' : 'Subir imagen'}
        </Button>
      </div>
    </div>
  )
}
