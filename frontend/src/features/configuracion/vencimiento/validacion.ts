// HU-118 (US-23) · FE-01 — Validación del umbral de días en el formulario.
// Refleja las reglas del backend (reglasUmbralVencimiento.js) para avisar antes de enviar;
// el servidor vuelve a validar, así que esto es solo ayuda al usuario (TC-02 / TC-05).

export const DIAS_MAXIMO = 3650

/** Devuelve el mensaje de error, o null si el valor es un entero positivo válido. */
export function errorUmbralDias(valor: string): string | null {
  const texto = valor.trim()
  if (texto === '') return 'Ingrese el número de días de anticipación.'
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(texto)) return 'El umbral de días debe ser un valor numérico.'
  const numero = Number(texto)
  if (numero <= 0) return 'El umbral de días debe ser mayor a cero (no se permiten negativos).'
  if (!Number.isInteger(numero)) return 'El umbral de días debe ser un número entero.'
  if (numero > DIAS_MAXIMO) return `El umbral de días no puede superar ${DIAS_MAXIMO}.`
  return null
}

export function textoDias(dias: number) {
  return `${dias} ${dias === 1 ? 'día' : 'días'}`
}
