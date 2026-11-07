# HU-82 · Entrenar modelo de predicción de demanda

> Como **administrador del sistema**, quiero ejecutar el entrenamiento del modelo de predicción de demanda con los
> datos históricos disponibles, para generar predicciones confiables.

## 1. Qué ya existía y qué se agregó

El proyecto ya tenía un entrenamiento funcional (HU-78): backtest para elegir los parámetros del modelo Holt amortiguado
estacional, versionado en `ml.modelos`, bitácora en `ml.entrenamientos_log` y la pantalla *Modelo de Machine Learning*.
HU-82 **reutiliza ese motor** y cierra lo que faltaba:

| Faltaba | Ahora |
|---|---|
| La **duración** del entrenamiento no se registraba (TC-05) | Se guarda inicio, fin y duración en la versión (`ml.modelos.metadata.entrenamiento`) y en la bitácora |
| Aviso de datos insuficientes genérico (TC-02/06) | Mensaje explícito *"No es posible entrenar el modelo con la información disponible"* + `detalle` numérico (filas válidas vs. mínimo, pruebas logradas vs. necesarias, duración) |
| Confirmación al administrador = una línea de texto (TC-07) | Panel de confirmación: versión, fecha, duración, datos usados, métricas y estado; se puede cerrar |
| Sin trazabilidad de quién entrenó | Se registra en `auditoria` (`entrenar_modelo_ml` / `entrenar_modelo_ml_sin_datos`) |
| Sin pruebas por caso de prueba | 17 pruebas backend + 5 de pantalla, una por cada TC |
| Bug: el backend **no arrancaba** (`routes/index.js` declaraba `prediccionRoutes` dos veces) | Corregido |
| `DB_SSL=true` se ignoraba al conectar a Supabase | `database.js` ahora activa SSL |

## 2. Subtareas

| Subtarea | Qué se hizo | Archivos |
|---|---|---|
| **HU-83 ML-01** Cargar datos preparados y entrenar | Carga ventas, descarta filas inválidas (TC-03), valida suficiencia y entrena; devuelve `datos_preparados` | `services/mlModeloService.js`, `services/mlEntrenamientoModelo.js` (sin cambios) |
| **HU-84 ML-02** Generar y guardar versión | Cada entrenamiento crea `v(n+1)` en `ml.modelos`; las anteriores se conservan; solo una activa | `services/mlModeloService.js`, `services/mlModeloRepositorio.js` |
| **HU-85 BE-01** Fecha/duración e indicar falta de datos | `reloj` inyectable, `medirTiempo`, `duracionTexto`, `ErrorML.detalle`, registro con fallback si faltan columnas, auditoría | `services/*`, `controllers/mlController.js`, `routes/ml.js`, `sql/ml_hu82_duracion_entrenamiento.sql` |
| **HU-86 FE-01** Confirmar al administrador | `ConfirmacionEntrenamiento`, `AvisoDatosInsuficientes`, columna *Duración*, *Historial de entrenamientos* | `features/modelo-ml/ModeloMLPage.tsx`, `api.ts` |
| **HU-87 QA-01** Ejecutar TC-01..TC-07 | Ver sección 4 | `tests/unit/ml-entrenamiento-hu82.test.js`, `tests/api/ml-entrenamiento.test.js`, `ModeloMLPage.test.tsx` |

## 3. API

`POST /api/ml/entrenamientos` (requiere sesión y el permiso de administrador `gestionar_usuarios`)

**201** — entrenamiento realizado:
```json
{ "data": {
  "modelo": { "id": 3, "version": "v3", "estado": "activo", "rmse_relativo": 0.18,
              "entrenamiento": { "iniciado_en": "…", "finalizado_en": "…", "duracion_ms": 2500, "duracion_texto": "2,5 s" } },
  "activado": true,
  "mensaje": "Modelo v3 entrenado y activado. … Duración del entrenamiento: 2,5 s.",
  "entrenamiento": { "iniciado_en": "…", "finalizado_en": "…", "duracion_ms": 2500, "duracion_texto": "2,5 s" },
  "datos_preparados": { "total_filas": 1010, "filas_validas": 1008, "filas_descartadas": 2, "motivos_descarte": { "cantidad_invalida": 2 } }
} }
```

**422** — datos insuficientes (no se crea ninguna versión; el intento queda en la bitácora):
```json
{ "error": "No hay datos históricos suficientes: hay 9 filas de ventas válidas y se necesitan al menos 50 (configuración min_filas_entrenamiento). No es posible entrenar el modelo con la información disponible.",
  "codigo": "datos_insuficientes",
  "detalle": { "filas_validas": 9, "minimo_filas": 50, "pruebas_logradas": null, "pruebas_necesarias": null, "duracion_ms": 400 } }
```

`GET /api/ml/modelos` ahora incluye `entrenamientos` (últimos 10 intentos con fecha y duración) y `versiones[].entrenamiento`.

## 4. QA-01 · Registro de resultados (TC-01 a TC-07)

Ejecutado el **06/11/2026** con Node 22.23 · datos simulados deterministas · tablas `ml.*` en memoria · API simulada en pantalla.

| TC | Criterio | Pruebas que lo cubren | Resultado |
|---|---|---|---|
| TC-01 | Entrenamiento exitoso y guarda versión | `HU-82 TC-01`, `TC-07 (servicio)` | ✅ Aprobado |
| TC-02 | Datos insuficientes → indica que no es posible entrenar | `HU-82 TC-02`, endpoint 422, pantalla `TC-02 y TC-06` | ✅ Aprobado |
| TC-03 | Usa los datos históricos preparados | `HU-82 TC-03` (3 filas inválidas descartadas, entrena con las válidas) | ✅ Aprobado |
| TC-04 | Genera y guarda nueva versión | `HU-82 TC-04` (v1 → v2, v1 se conserva, una sola activa) | ✅ Aprobado |
| TC-05 | Registra fecha y duración | 3 pruebas backend + historial en pantalla (también para intentos fallidos) | ✅ Aprobado |
| TC-06 | Indica cuando faltan datos | 2 pruebas backend (por filas y por historial corto) + pantalla | ✅ Aprobado |
| TC-07 | Confirma el entrenamiento exitoso | servicio, endpoint 201, pantalla (panel + cerrar) | ✅ Aprobado |

Totales vigentes (HU-82 + HU-88) en `docs/HU-88_metricas_desempeno_modelo.md`, sección 4.

### Pendiente de verificar en TU entorno (no se pudo desde el entorno de desarrollo, que no alcanza Supabase)
1. **Prueba extremo a extremo con la BD real**: iniciar sesión como administrador → *Modelo de Machine Learning* → *Entrenar modelo*.
   Debe aparecer el panel verde con versión, fecha y duración, y una fila nueva en *Historial de versiones* y en *Historial de entrenamientos*.
2. **TC-02 real**: con pocas ventas (o subiendo `min_filas_entrenamiento` en `ml.configuracion`) debe aparecer el aviso ámbar.
3. Opcional: ejecutar `backend/sql/ml_hu82_duracion_entrenamiento.sql` en Supabase para guardar la duración también como columnas.
   Sin él todo funciona (la duración queda en `metadata` y en el texto del mensaje).

## 5. Cómo ejecutar

```bash
# Backend
cd backend && npm install
node --test --test-force-exit tests/unit/ml-entrenamiento-hu82.test.js tests/api/ml-entrenamiento.test.js
npm run dev                      # http://localhost:3000

# Frontend
cd frontend && npm install
npm test                         # vitest
npm run dev                      # http://localhost:5173
```
