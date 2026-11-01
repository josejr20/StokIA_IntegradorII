// PASO 2: guardar como frontend/src/features/clientes/ruc.ts
// Usa el mismo helper `api` que ya usa reniec.ts.
import { api } from '@/lib/api'

export interface EmpresaSunat {
  ruc: string
  razon_social: string
  tipo: string
  estado: string
  condicion: string
  domicilio_fiscal: string
}

export function buscarEmpresaPorRuc(ruc: string) {
  return api.get<EmpresaSunat>(`/ruc/${encodeURIComponent(ruc)}`)
}