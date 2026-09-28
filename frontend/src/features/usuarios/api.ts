import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'

export interface Rol {
  id: number
  nombre: string
  descripcion?: string | null
}

export interface Usuario {
  id: number
  nombres: string
  apellidos: string
  dni: string
  email: string
  rol_id: number
  rol: string | null
  activo: boolean
  fecha_creacion: string
  ultimo_acceso: string | null
}

export interface CrearUsuarioInput {
  nombres: string
  apellidos: string
  dni: string
  email: string
  password: string
  rol_id: number
  clave_secreta: string
}

export function useUsuarios() {
  return useQuery({
    queryKey: ['usuarios'],
    queryFn: async () => {
      const respuesta = await api.get<{ data: Usuario[] }>('/usuarios')
      return respuesta.data
    },
  })
}

export function useRoles() {
  return useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const respuesta = await api.get<{ data: Rol[] }>('/roles')
      return respuesta.data
    },
  })
}

export function useCrearUsuario() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (datos: CrearUsuarioInput) => {
      const respuesta = await api.post<{ data: Usuario }>('/usuarios', datos)
      return respuesta.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] })
    },
  })
}