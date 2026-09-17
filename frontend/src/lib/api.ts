/**
 * Cliente HTTP hacia la API de negocio (Django).
 * Guarda el access/refresh token en localStorage y renueva el access token
 * una sola vez si el backend responde 401, antes de darle el error al que
 * llamó. Ningún componente arma fetch() a mano: todos pasan por acá.
 */
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api'

const ACCESS_KEY = 'stockia_access'
const REFRESH_KEY = 'stockia_refresh'

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY)
}

export function setTokens(access: string, refresh?: string) {
  localStorage.setItem(ACCESS_KEY, access)
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh)
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

async function refrescarToken(): Promise<boolean> {
  const refresh = localStorage.getItem(REFRESH_KEY)
  if (!refresh) return false
  const respuesta = await fetch(`${API_URL}/auth/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  })
  if (!respuesta.ok) return false
  const datos = await respuesta.json()
  setTokens(datos.access)
  return true
}

export class ApiError extends Error {
  status: number
  body: unknown
  constructor(status: number, body: unknown) {
    super(typeof body === 'object' && body && 'detail' in body ? String((body as any).detail) : 'Error de API')
    this.status = status
    this.body = body
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  _reintentado = false,
): Promise<T> {
  const token = getAccessToken()
  const headers = new Headers(options.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const respuesta = await fetch(`${API_URL}${path}`, { ...options, headers })

  if (respuesta.status === 401 && !_reintentado) {
    const renovado = await refrescarToken()
    if (renovado) return apiFetch<T>(path, options, true)
    clearTokens()
    window.location.href = '/login'
    throw new ApiError(401, { detail: 'Sesión expirada' })
  }

  if (!respuesta.ok) {
    const cuerpo = await respuesta.json().catch(() => ({}))
    throw new ApiError(respuesta.status, cuerpo)
  }

  if (respuesta.status === 204) return undefined as T
  return respuesta.json() as Promise<T>
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  del: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
  postForm: <T>(path: string, form: FormData) => apiFetch<T>(path, { method: 'POST', body: form }),
  patchForm: <T>(path: string, form: FormData) => apiFetch<T>(path, { method: 'PATCH', body: form }),
}
