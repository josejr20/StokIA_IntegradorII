
import { useState } from 'react'
import PriorizacionInventario from './PriorizacionInventario'
import RecomendacionesUS21 from './RecomendacionesUS21'

type Vista = 'priorizacion' | 'recomendaciones'

export default function PrediccionPage() {
  const [vista, setVista] = useState<Vista>('priorizacion')

  const estiloBoton = (activo: boolean) =>
    `rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
      activo
        ? 'border-green-800 bg-green-900 text-white'
        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-100'
    }`

  return (
    <div className="space-y-4">
      <nav
        className="flex flex-wrap gap-3 px-4 pt-4 md:px-6"
        aria-label="Secciones de predicción y riesgo"
      >
        <button
          type="button"
          aria-pressed={vista === 'priorizacion'}
          className={estiloBoton(vista === 'priorizacion')}
          onClick={() => setVista('priorizacion')}
        >
          Priorización de inventario
        </button>

        <button
          type="button"
          aria-pressed={vista === 'recomendaciones'}
          className={estiloBoton(vista === 'recomendaciones')}
          onClick={() => setVista('recomendaciones')}
        >
          Recomendaciones US-21
        </button>
      </nav>

      {vista === 'priorizacion' ? (
        <PriorizacionInventario />
      ) : (
        <RecomendacionesUS21 />
      )}
    </div>
  )
}
