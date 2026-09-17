// Tipos que reflejan los serializers de Django REST Framework.
// Cuando el backend cambie un campo, este archivo es el primero en tocar.

export interface Usuario {
  id: number
  nombre: string
  email: string
  rol: number
  rol_nombre: string
  activo: boolean
  fecha_creacion: string
  ultimo_acceso: string | null
}

export interface Paginado<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}
