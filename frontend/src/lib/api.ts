/**
 * Cliente HTTP hacia la API de negocio (Express + Sequelize + DTO).
 * Usa cookies HttpOnly para la sesión y renueva el access token una sola vez
 * si el backend responde 401. Ningún componente arma fetch() a mano.
 *
 * Convenciones del backend Express:
 *  - Login:            POST /api/auth/login  -> { usuario, token, refreshToken }
 *  - Refresh:          POST /api/auth/refresh -> { token, refreshToken }
 *  - Listar/obtener:   { data: [...] } o { data: {...} }
 *  - Crear:            201 con { data: {...} }
 *  - Errores:          { error: " mensaje " } o { error, details }
 */
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api'

export function resolverImagenProducto(imagen: string | null | undefined) {
  if (!imagen) return null
  if (/^https?:\/\//i.test(imagen)) return imagen
  const ruta = imagen.startsWith('/upload/') ? imagen : `/upload/${imagen}`
  return `${API_URL.replace(/\/api\/?$/, '')}${ruta}`
}

async function refrescarToken(): Promise<boolean> {
  const respuesta = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  })
  if (! respuesta.ok) return false
  return true
}

export class ApiError extends Error {
  status: number
  body: unknown
  constructor(status: number, body: unknown) {
    super(ApiError.extraer(body))
    this.status = status
    this.body = body
  }

  // El backend Express devuelve { error: " mensaje " }. Un error de validacion
  // de campo viene como { error: 'Datos invalidos', details: [...] }.
  static extraer(body: unknown): string {
    if (body && typeof body === 'object') {
      const objeto = body as Record<string, unknown>
      if (typeof objeto.error === 'string') return objeto.error
      if (Array.isArray(objeto.details) && objeto.details.length) {
        const primer = objeto.details[0] as Record<string, unknown>
        if (primer && typeof primer.msg === 'string') return primer.msg
      }
    }
    return 'Error de API'
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  _reintentado = false,
): Promise<T> {
  const headers = new Headers(options.headers)
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const respuesta = await fetch(`${API_URL}${path}`, { ...options, headers, credentials: 'include' })

  const endpointSinRefresh = ['/auth/me', '/auth/login', '/auth/register', '/auth/registro', '/auth/google', '/auth/forgot-password', '/auth/verify-reset-code', '/auth/reset-password'].includes(path)
  if ( respuesta.status === 401 && !_reintentado && !endpointSinRefresh) {
    const renovado = await refrescarToken()
    if (renovado) return apiFetch<T>(path, options, true)
    if (path !== '/auth/me') window.location.href = '/login'
    throw new ApiError(401, { error: 'Sesión expirada' })
  }

  if (! respuesta.ok) {
    const cuerpo = await respuesta.json().catch(() => ({}))
    throw new ApiError(respuesta.status, cuerpo)
  }

  if ( respuesta.status === 204) return undefined as T
  return respuesta.json() as Promise<T>
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  del: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
  postForm: <T>(path: string, form: FormData) => apiFetch<T>(path, { method: 'POST', body: form }),
  putForm: <T>(path: string, form: FormData) => apiFetch<T>(path, { method: 'PUT', body: form }),
  patchForm: <T>(path: string, form: FormData) => apiFetch<T>(path, { method: 'PATCH', body: form }),
}