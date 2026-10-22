const CLAVE = 'ip_address'

export async function obtenerIP(): Promise<string | null> {
  try {
    const guardada = localStorage.getItem(CLAVE)
    if (guardada) return guardada
  } catch {
    // localStorage puede estar bloqueado
  }

  try {
    const res = await fetch('https://api.ipify.org?format=json')
    if (res.ok) {
      const data = (await res.json()) as { ip?: string }
      if (data.ip) {
        try {
          localStorage.setItem(CLAVE, data.ip)
        } catch {
          // ignorar
        }
        return data.ip
      }
    }
  } catch {
    // sin conexion o bloqueado por CORS
  }
  return null
}
