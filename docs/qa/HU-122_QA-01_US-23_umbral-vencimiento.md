# HU-122 · QA-01 — Resultados de pruebas de la HU-118 (US-23)

**Historia:** Configurar umbral de días para alerta de vencimiento  
**Subtareas cubiertas:** HU-119 (BE-01), HU-120 (BE-02), HU-121 (FE-01)  
**Fecha de ejecución:** 2026-11-06 · **Entorno:** Node 22, pruebas automatizadas sin base de datos (repositorio en memoria)  
**Comando:** `cd backend && node --test tests/unit/umbral-vencimiento.test.js` → **14 pruebas, 14 pasaron, 0 fallaron**

## Resultados por caso de prueba

| TC | Caso | Prueba automatizada | Resultado |
|----|------|---------------------|-----------|
| TC-01 | Configuración exitosa: el nuevo valor se aplica en los próximos cálculos | `TC-01: el nuevo umbral guardado se aplica en el siguiente cálculo de riesgo` | ✅ Pasó |
| TC-02 | Valor inválido (negativo o no numérico): se rechaza y no cambia nada | `TC-02 y TC-05: rechaza negativos, cero, decimales, texto y vacíos`; `TC-02: un valor inválido no modifica la configuración guardada` | ✅ Pasó |
| TC-03 | Permite definir el umbral en días | `TC-03: permite definir el umbral en días y lo informa en la configuración` | ✅ Pasó |
| TC-04 | Aplica el umbral a los cálculos de riesgo | `TC-04: aplica el umbral al riesgo y ordena…` (límites 0, 14, 15, 16 días y vencidos); `TC-04: las reglas clasifican…`; `TC-04: al guardar se actualizan las alertas…` | ✅ Pasó |
| TC-05 | Valida que el valor sea numérico y positivo | `TC-05: acepta enteros positivos como número o texto` + las de TC-02 | ✅ Pasó |
| TC-06 | Umbrales distintos por categoría | `TC-06: permite umbrales distintos por categoría…`; `TC-06: restablecer una categoría…`; `TC-06: rechaza una categoría que no existe…` | ✅ Pasó |
| TC-07 | Confirma el cambio de configuración | `TC-07: confirma el cambio con un mensaje claro` | ✅ Pasó |

Pruebas extra: valor dañado en la base se ignora (`un valor dañado…`) y jerarquía categoría > general > predeterminado (`el resolvedor…`).

Valores de entrada rechazados en TC-02/TC-05: `-5`, `'-5'`, `0`, `2.5`, `'abc'`, `''`, `'   '`, `null`, `undefined`, `NaN`, `Infinity`, `true`, `{}`, `[]`, `'1e2'`, `3651`.

## Verificaciones del frontend (FE-01)
- `frontend/src/features/configuracion/vencimiento/validacion.test.ts` (Vitest) cubre la validación del formulario. El runner de Vitest se ejecutó junto con el test de formato del histórico: **19 pruebas pasaron, 0 fallaron**.

## Pendiente de ejecutar manualmente (necesita la app corriendo con la BD de Supabase)
| # | Paso | Esperado |
|---|------|----------|
| M-1 | Configuración → pestaña «Alerta de vencimiento» → escribir `-3` y guardar | Mensaje de error rojo; no se envía la petición |
| M-2 | Escribir `abc` y guardar | Mensaje «debe ser un valor numérico» |
| M-3 | Guardar `15` como umbral general | Mensaje verde de confirmación + aviso emergente |
| M-4 | Guardar `5` para una categoría y luego «Usar general» | Confirmación; la categoría vuelve a 15 |
| M-5 | «Recalcular alertas» y abrir la campana de alertas | Aparecen alertas `riesgo_vencimiento` según el umbral |
| M-6 | Predicción y riesgo | El motivo «Vencimiento en N día(s)» respeta el umbral de la categoría |
| M-7 | Probar `PUT /api/umbrales/vencimiento` con `{"dias":-1}` | HTTP 400 con `{"error": "..."}` |

## Observaciones
- Las pruebas del controlador HTTP no se ejecutaron aquí (requieren `node_modules` y la BD); la lógica está cubierta a nivel de servicio.
- El umbral se guarda en la tabla `configuraciones` (ya existente): **no requiere migraciones**.
