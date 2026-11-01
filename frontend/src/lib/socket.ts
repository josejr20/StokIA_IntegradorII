import { useEffect } from 'react'
import { io, type Socket } from 'socket.io-client'
import { useQueryClient } from '@tanstack/react-query'

const BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api').replace(/\/api\/?$/, '')

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = io(BASE_URL, { path: '/socket.io', withCredentials: true, transports: ['websocket'] })
  }
  return socket
}

export function useInventarioRealtime() {
  const queryClient = useQueryClient()
  useEffect(() => {
    const s = getSocket()
    const invalidar = () => {
      void queryClient.invalidateQueries({ queryKey: ['lotes'] })
      void queryClient.invalidateQueries({ queryKey: ['movimientos-inventario'] })
      void queryClient.invalidateQueries({ queryKey: ['productos'] })
    }
    s.on('lote:creado', invalidar)
    s.on('lote:actualizado', invalidar)
    s.on('movimiento:creado', invalidar)
    s.on('inventario:actualizado', invalidar)
    return () => {
      s.off('lote:creado', invalidar)
      s.off('lote:actualizado', invalidar)
      s.off('movimiento:creado', invalidar)
      s.off('inventario:actualizado', invalidar)
    }
  }, [queryClient])
}
