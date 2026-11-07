# HU-132 · QA-01 — Resultados de pruebas de la HU-128 (US-25)

**Historia:** Consultar histórico de predicciones vs ventas reales  
**Subtareas cubiertas:** HU-129 (BE-01), HU-130 (FE-01), HU-131 (FE-02)  
**Fecha de ejecución:** 2026-11-06 · **Entorno:** Node 22, pruebas automatizadas con ventas simuladas y repositorio en memoria  
**Comando:** `cd backend && node --test tests/unit/historico-prediccion.test.js` → **15 pruebas, 15 pasaron, 0 fallaron**

## Resultados por caso de prueba

| TC | Caso | Prueba automatizada | Resultado |
|----|------|---------------------|-----------|
| TC-01 | Comparación exitosa: muestra ambos valores | `TC-01 y TC-03: muestra predicción y venta real…`; `TC-01: la predicción de un periodo solo usa lo vendido ANTES del periodo` | ✅ Pasó (datos listos para graficar) |
| TC-02 | Periodo sin ventas reales: indica que no hay datos suficientes | `TC-02 y TC-07: un periodo sin ventas reales indica…` | ✅ Pasó |
| TC-03 | Predicción y venta real por producto y periodo | `TC-01 y TC-03…` | ✅ Pasó |
| TC-04 | Diferencia porcentual | `TC-04: calcula la diferencia porcentual…`; `…resumen calcula error ponderado, precisión y sesgo`; `…totales por periodo suman solo filas comparables` | ✅ Pasó |
| TC-05 | Visualización gráfica | Backend entrega `periodos[]` con ambos valores; `formato.test.ts` valida `datosGrafico` | ✅ Backend / ⏳ Gráfica por validar en navegador |
| TC-06 | Filtrar por producto o rango de fechas | `TC-06: filtra por producto`; `…rango de fechas y tamaño de periodo`; `…valida los filtros`; `…sin filtros usa las últimas 12 semanas` | ✅ Pasó |
| TC-07 | Indica cuando no hay datos suficientes | `TC-07: sin ventas en todo el rango…`; `TC-07: con ventas reales pero sin historial…` | ✅ Pasó |

Pruebas extra: producto inexistente → 404; solo ventas netas (`manual`, `importado`); el controlador responde 400 con filtros inválidos.

## Método de comparación (para el equipo)
No existe una tabla de predicciones guardadas, así que la comparación es una **prueba hacia atrás** con el mismo modelo de HU-72: para cada periodo se predice con lo vendido hasta el día anterior y se compara con lo realmente vendido.  
`diferencia = predicción − venta real` (positivo = el modelo sobreestimó); `diferencia % = diferencia / venta real × 100`.

## Verificaciones del frontend (FE-01 / FE-02)
- `frontend/src/features/prediccion/historico/formato.test.ts` (Vitest). El runner de Vitest se ejecutó junto con el test de validación del umbral: **19 pruebas pasaron, 0 fallaron**.

## Pendiente de ejecutar manualmente (necesita la app corriendo con la BD de Supabase)
| # | Paso | Esperado |
|---|------|----------|
| M-1 | Menú → «Predicción vs ventas» con un producto con ≥ 4 meses de ventas | Gráfica de barras (venta real) + línea (predicción), tarjetas de precisión y tabla |
| M-2 | Elegir un producto/rango sin ventas | Aviso ámbar «No hay datos suficientes para comparar» (sin gráfica) |
| M-3 | Rango donde un periodo no tuvo ventas | Gráfica con hueco y lista «Periodos sin datos suficientes» |
| M-4 | Filtrar por producto, fechas y tamaño de periodo | La gráfica y la tabla se actualizan |
| M-5 | «Desde» posterior a «Hasta» | Mensaje de error, sin consulta |
| M-6 | Entrar con un usuario sin `ver_kpis` | La ruta no aparece ni es accesible |

## Observaciones
- Con pocas ventas (< 14 días de historial antes del periodo) el modelo no predice: se muestra «historial insuficiente», no un cero.
- Sin filtro de producto se muestran los 100 con más ventas del rango.
