# US-22 / HU-117: Plan de pruebas de aceptación

**Proyecto:** StockIA
**Rama de trabajo:** `feature/us-22-anomalias`
**Fecha:** 4 de noviembre de 2026
**Alcance:** detector de anomalías de ventas e inventario, persistencia de alertas y exclusión de ventas anómalas del modelo predictivo.

## Evidencia inicial y sus límites

- 9 pruebas de HU-114, 10 de HU-115 y 15 de HU-116: **34/34 aprobadas** según la salida local de Node facilitada por el equipo.
- Son pruebas automatizadas principalmente con datos simulados, no pruebas contra la base de datos real ni el flujo completo desde la interfaz.
- El registro de alertas se ejecuta actualmente mediante `POST /api/alertas/anomalias-local/evaluar` con `{"confirmar":true}`; NO se ha verificado la activación automática al realizar una venta.
- El servicio actual guarda alertas consultables en StockIA. No se ha verificado un aviso emergente, correo o notificación en tiempo real al administrador.

## Casos de aceptación

| Caso | Acción | Resultado esperado | Evidencia actual | Estado de aceptación |
|---|---|---|---|---|
| TC-01 | Registrar una venta/movimiento fuera de lo habitual y ejecutar análisis. | Detectar el registro, marcarlo y avisar al administrador. | Pruebas HU-114 y HU-115 sobre datos simulados. | Pendiente: flujo real y aviso al administrador. |
| TC-02 | Evaluar historial de cantidades normales. | No generar alertas de anomalía. | Pruebas HU-114 y HU-115. | Pendiente: verificación real. |
| TC-03 | Evaluar ventas y movimientos de inventario. | Analizar ambas fuentes y relacionar movimiento con lote y producto. | Pruebas HU-114 y HU-115. | Pendiente: verificación real. |
| TC-04 | Ejecutar análisis con un registro atípico. | Guardar una alerta de tipo `anomalia`, vinculada al registro, sin duplicarla. | Pruebas HU-115. | Pendiente: confirmar persistencia en BD real. |
| TC-05 | Entrar como administrador y consultar las notificaciones/alertas. | El administrador puede identificar y revisar el caso anómalo. | Alerta de tipo `anomalia` generada en pruebas simuladas. | Pendiente: visibilidad/aviso real en la interfaz. |
| TC-06 | Generar una predicción de producto con una venta anómala ya alertada. | Excluir temporalmente SOLO esa venta; conservar registro y reincluirlo al descartar la alerta. | 15 pruebas HU-116. | Pendiente: comparar predicción real. |
| TC-07 | Evaluar datos de ventas e inventario consistentes. | No crear alertas innecesarias. | Pruebas HU-114 y HU-115. | Pendiente: verificación real. |

## Prueba segura con la API

La aplicación requiere autenticación y permiso `ver_alertas`.

1. **Solo lectura:** consultar `GET /api/alertas/anomalias-local/vista-previa?diasHistorial=180`. Comprobar `modo: "vista_previa"`, registros consultados y `muestra_anomalias`. La vista previa **no** guarda nada.
2. Revisar los falsos positivos, si hay registros suficientes y si el volumen está dentro del límite de seguridad.
3. **Solo con autorización y una base de pruebas**: `POST /api/alertas/anomalias-local/evaluar`, JSON `{"confirmar":true,"diasHistorial":180,"limiteNuevas":10}`. Esta operación **sí crea alertas**.
4. Verificar lectura de `GET /api/alertas?tipo=anomalia`, acceso del administrador, ausencia de duplicados y el valor `calidad_datos.ventas_anomalas_excluidas` en el resultado de predicción.
5. Confirmar comportamiento cuando una alerta se marca `descartada` y repetir la predicción. No modificar datos productivos para esta prueba.

## Revisión técnica antes de Pull Request

Desde la raíz del repositorio, ejecutar:

```powershell
node --test backend/tests/anomalias-us22.test.js backend/tests/anomalias-registro-us22.test.js backend/tests/anomalias-prediccion-us22.test.js
node --check backend/src/routes/alertas.js
node --check backend/src/controllers/anomaliasLocalController.js
node --check backend/src/services/anomaliasRegistroService.js
node --check backend/src/services/filtroAnomaliasPrediccion.js
node --check backend/src/services/prediccionDemandaService.js
git diff --check
git status --short
```

**No incluir en el Pull Request:** archivos `.env`, `*.bak`, archivos de descargas, resultados temporales ni datos sensibles. Revisar los archivos uno por uno antes de `git add`.

## Registro de ejecución real (completar con el tester)

| Caso | Fecha | Ambiente | Resultado | Evidencia (captura/enlace) | Observaciones |
|---|---|---|---|---|---|
| TC-01 | | | Pendiente | | |
| TC-02 | | | Pendiente | | |
| TC-03 | | | Pendiente | | |
| TC-04 | | | Pendiente | | |
| TC-05 | | | Pendiente | | |
| TC-06 | | | Pendiente | | |
| TC-07 | | | Pendiente | | |

**Condición de cierre:** no declarar HU-117 aprobada hasta ejecutar los casos sobre una instalación de StockIA y registrar la evidencia requerida por el tester. El Pull Request debe enviarse para revisión, nunca fusionarse directamente a `main` sin autorización.
