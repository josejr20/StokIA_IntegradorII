# HU-88 · Evaluar métricas de desempeño del modelo

> Como **administrador del sistema**, quiero visualizar las métricas de desempeño del modelo (MAE, RMSE), para verificar
> la calidad de las predicciones generadas.

## 1. Qué ya existía y qué se agregó

Ya se calculaban MAE, RMSE y RMSE relativo en cada entrenamiento (HU-78/82) y las versiones nuevas que no cumplían el
umbral quedaban como "requiere revisión". HU-88 completa lo que faltaba:

| Faltaba | Ahora |
|---|---|
| No había forma de **comparar versiones** (TC-05) | `GET /api/ml/metricas` trae cada versión con su comparación contra la anterior (`vs_anterior`: mejora / empeora / igual) y la mejor versión; `GET /api/ml/metricas/comparacion?base=&nueva=` compara dos versiones cualesquiera |
| El **historial de métricas se perdía**: cada evaluación pisaba a la anterior (TC-07) | Cada evaluación se agrega a `metadata.historial_evaluaciones` de la versión (últimas 30) |
| El modelo **activo** que empeoraba solo generaba un aviso, no quedaba marcado (TC-02/06) | Si una evaluación supera el umbral, la versión activa queda con `estado_revision = requiere_revision`; si se recupera, vuelve a `aprobado` |
| Métricas sin explicación (TC-04) | Cada versión trae `calidad` (buena / aceptable / requiere revisión), `mae_relativo` e `interpretacion` en lenguaje de negocio |

Regla de calidad: **buena** hasta 2/3 del umbral, **aceptable** hasta el umbral (30 % por defecto, `CONFIG_ML.UMBRAL_RMSE_RELATIVO`),
**requiere revisión** por encima. No se necesita ninguna columna nueva en la base de datos: todo va en `ml.modelos.metadata`.

## 2. Subtareas

| Subtarea | Qué se hizo | Archivos |
|---|---|---|
| **HU-89 ML-01** Calcular MAE y RMSE tras cada entrenamiento | Ya se calculaba; se verifica con pruebas y se expone junto con `mae_relativo`, calidad e interpretación | `services/mlModeloService.js` |
| **HU-90 FE-01** Mostrar métricas comprensibles y comparar versiones | Nuevo `MetricasPanel`: tarjetas MAE/RMSE/Calidad con explicación, barras de RMSE relativo con línea de umbral, tabla de comparación, selector de dos versiones e historial | `frontend/src/features/modelo-ml/MetricasPanel.tsx`, `api.ts`, `ModeloMLPage.tsx` |
| **HU-91 BE-01** Marcar el modelo y registrar historial | `requiereRevision`, marcado del modelo activo al evaluar, historial por versión, endpoints de métricas y comparación | `services/mlModeloService.js`, `controllers/mlController.js`, `routes/ml.js` |
| **HU-92 QA-01** Ejecutar TC-01..TC-07 | Ver sección 4 | `tests/unit/ml-metricas-hu88.test.js`, `tests/unit/ml-entrenamiento.test.js`, `frontend/src/features/modelo-ml/MetricasPanel.test.tsx` |

## 3. API (requiere sesión y permiso `ver_kpis`)

`GET /api/ml/metricas`
```json
{ "data": { "umbral_rmse_relativo": 0.3, "modelo_activo_id": 2, "mejor_version_id": 2, "hay_modelo_entrenado": true,
  "versiones": [ { "id": 2, "version": "v2", "mae": 6, "rmse": 8, "rmse_relativo": 0.16, "mae_relativo": 0.12,
    "calidad": "buena", "cumple_umbral": true, "requiere_revision": false,
    "interpretacion": "En promedio, la predicción semanal de un producto se equivoca en 6 unidades (MAE). …",
    "vs_anterior": { "veredicto": "mejora", "mae": { "base": 10, "nueva": 6, "diferencia": -4, "porcentaje": -40, "tendencia": "mejora" } },
    "historial_evaluaciones": [ { "fecha": "…", "mae": 8, "rmse": 11, "rmse_relativo": 0.17, "aprobado": true } ] } ] } }
```
`GET /api/ml/metricas/comparacion?base=1&nueva=2` → diferencias de MAE, RMSE y RMSE relativo y `veredicto`. 400 si faltan/son iguales, 404 si no existe.

## 4. QA-01 · Registro de resultados (TC-01 a TC-07)

Ejecutado el **06/11/2026**, Node 22.23, datos simulados y tablas `ml.*` en memoria; API simulada en pantalla.

| TC | Criterio | Pruebas que lo cubren | Resultado |
|---|---|---|---|
| TC-01 | Consulta exitosa: muestra MAE y RMSE | backend (con y sin modelo entrenado) + pantalla (2) | ✅ Aprobado |
| TC-02 | Sobre el umbral → "requiere revisión" | backend (marca y recuperación) + pantalla (alerta roja) | ✅ Aprobado |
| TC-03 | Calcula MAE y RMSE tras cada entrenamiento | backend (2 entrenamientos, valores guardados en `ml.modelos`) | ✅ Aprobado |
| TC-04 | Métricas comprensibles | backend (niveles y texto) + pantalla (explicaciones) | ✅ Aprobado |
| TC-05 | Compara desempeño entre versiones | backend (3: vs anterior, mejor versión, validaciones) + pantalla (2) | ✅ Aprobado |
| TC-06 | Marca cuando el error supera el umbral | backend (marca / no marca) + pantalla | ✅ Aprobado |
| TC-07 | Historial de métricas por versión | backend (3: evaluaciones, tope de 30, conservación) + pantalla (2) | ✅ Aprobado |

Hallazgos corregidos durante QA: un borde de redondeo decimal en el nivel de calidad (0,2 vs 2/3 de 0,3) y el estado de la versión más reciente en la vista de métricas.

**Totales actuales del proyecto (HU-82 + HU-88):** backend 97 pruebas → 96 aprobadas, 0 fallidas, 1 omitida (`postgres.smoke`, requiere BD);
frontend 13 pruebas aprobadas; `tsc -b`, `vite build` y `oxlint` sin errores.

### Pendiente de verificar en tu entorno (no se pudo con Supabase real)
1. Entrenar al menos 2 versiones y abrir **Modelo de Machine Learning**: debe verse el bloque *Métricas de desempeño* con MAE, RMSE, calidad, barras, tabla de comparación e historial.
2. Pulsar **Evaluar desempeño actual** varias veces: el historial de la versión activa debe sumar una fila por evaluación.
3. Para ver la marca de revisión: bajar `UMBRAL_RMSE_RELATIVO` temporalmente o evaluar cuando las ventas recientes cambien mucho.
