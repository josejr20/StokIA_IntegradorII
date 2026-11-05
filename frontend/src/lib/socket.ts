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

export function useOperacionesRealtime() {
  const queryClient = useQueryClient()
  useEffect(() => {
    const s = getSocket()
    const invalidar = () => {
      void queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0]
          if (key !== 'operaciones') return false
          if (Array.isArray(query.queryKey) && query.queryKey.includes('comprobante')) return false
          return true
        },
      })
      void queryClient.invalidateQueries({ queryKey: ['ventas'] })
      void queryClient.invalidateQueries({ queryKey: ['productos'] })
      void queryClient.invalidateQueries({ queryKey: ['lotes'] })
      void queryClient.invalidateQueries({ queryKey: ['movimientos-inventario'] })
      void queryClient.invalidateQueries({ queryKey: ['inicio'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    }
    s.on('operacion:creada', invalidar)
    s.on('operacion:anulada', invalidar)
    s.on('operacion:actualizada', invalidar)
    return () => {
      s.off('operacion:creada', invalidar)
      s.off('operacion:anulada', invalidar)
      s.off('operacion:actualizada', invalidar)
    }
  }, [queryClient])
}
