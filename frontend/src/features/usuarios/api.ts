import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/lib/api'

export interface Rol {
  id: number
  nombre: string
  descripcion?: string | null
}

export interface Usuario {
  id: number
  nombre: string
  email: string
  rol_id: number
  rol: string | null
  activo: boolean
  fecha_creacion: string
}

export interface CrearUsuarioInput {
  nombre: string
  email: string
  password: string
  rol_id: number
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