# HU-137 — QA-01: Registro de pruebas

**Historia:** HU-133 / US-26 — Generación automática de órdenes de reabastecimiento
**Fecha:** 01/11/2026
**Rama:** HU-133_US-26_Generar-orden

## Resultados

| Caso | Resultado | Evidencia |
|---|---|---|
| TC-01 | Aprobado (unitario) | Generación de orden ante stock bajo y riesgo de quiebre |
| TC-02 | Aprobado (unitario) | No genera orden cuando el stock es suficiente |
| TC-03 | Aprobado (unitario) | Detecta productos que requieren reabastecimiento |
| TC-04 | Aprobado (unitario) | Calcula cantidad sugerida de 25 unidades para el escenario probado |
| TC-05 | Aprobado (simulado) | Crea una orden pendiente y evita duplicados |
| TC-06 | Aprobado (unitario) | Invoca la notificación al generar la orden |
| TC-07 | Aprobado (unitario) | No genera orden ni alerta cuando el stock es suficiente |

## Ejecución automatizada

Comando:

node --test tests/reabastecimiento-automatico.test.js tests/reabastecimiento-cron.test.js tests/prediccion-demanda.test.js

Resultados generales:
- Pruebas ejecutadas: 19
- Aprobadas: 19
- Fallidas: 0

Nota: el total incluye pruebas del módulo de predicción de demanda.

## Pruebas pendientes de integración

- Comprobar la ejecución programada del cron con una base de datos de pruebas.
- Comprobar la recepción del evento WebSocket con una cuenta Encargado de Inventario (rol 2).
- No se realizaron inserciones de prueba en la base de datos compartida de Supabase.

## Conclusión

Los casos TC-01 a TC-07 cuentan con evidencia de pruebas unitarias o simuladas aprobadas. La validación integral de TC-05 y TC-06 permanece pendiente.
