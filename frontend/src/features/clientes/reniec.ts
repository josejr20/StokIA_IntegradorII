// (ajusta la ruta de carpeta a tu proyecto).
//
// Asume que '@/lib/api' exporta un objeto `api` con método get<T>(url)
// que devuelve el JSON ya parseado y lanza ApiError si el backend responde
// con error. Si tu helper se llama distinto, cambia solo estas dos funciones.
import { api } from '@/lib/api'

export interface PersonaReniec {
  dni: string
  nombres: string
  apellido_paterno: string
  apellido_materno: string
}

export function buscarPersonaPorDni(dni: string) {
  return api.get<PersonaReniec>(`/reniec/dni/${encodeURIComponent(dni)}`)
}

export function buscarPersonasPorNombre(datos: {
  nombres: string
  apellido_paterno: string
  apellido_materno: string
}) {
  const params = new URLSearchParams({
    nombres: datos.nombres,
    apellido_paterno: datos.apellido_paterno,
    apellido_materno: datos.apellido_materno,
  })
  return api.get<PersonaReniec[]>(`/reniec/buscar?${params.toString()}`)
}