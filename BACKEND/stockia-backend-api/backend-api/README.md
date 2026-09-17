# StockIA — API de negocio (backend-api)

Backend tradicional del sistema, en Django + Django REST Framework.
Cubre RF1-RF5, RF11, RF13: autenticación y roles, productos, lotes e
inventario, ventas, umbrales, reabastecimiento, alertas, reportes,
preferencias y auditoría.

Todo lo relacionado a Machine Learning (predicción, riesgo, anomalías,
entrenamiento) vive en el servicio aparte `ml-service` (FastAPI). Este
backend nunca toca esas tablas directamente: les pide todo a través de
`ml_client/client.py`, que es el túnel hacia ese servicio.

## Primeros pasos

1. Corre en Supabase (SQL Editor) el bloque de roles/GRANTs y el esquema
   `ml` completo de `stockia_schema.sql`. El esquema `negocio` no lo
   corras a mano: lo crea Django en el paso 4.

2. Crea el entorno virtual e instala dependencias:

   ```bash
   python -m venv venv
   source venv/bin/activate  # en Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. Copia `.env.example` a `.env` y completa los datos de conexión a
   Supabase con las credenciales de `business_api_role`.

4. Crea las tablas del esquema `negocio` a partir de los modelos:

   ```bash
   python manage.py makemigrations
   python manage.py migrate
   ```

5. Carga los roles y permisos iniciales:

   ```bash
   python manage.py seed_inicial
   ```

6. Crea un superusuario para entrar al panel de administración:

   ```bash
   python manage.py createsuperuser
   ```

7. Levanta el servidor:

   ```bash
   python manage.py runserver
   ```

   La API queda en `http://localhost:8000/api/` y el panel de
   administración (HU35) en `http://localhost:8000/admin/`.

## Jobs programados

Estos comandos están pensados para correr por cron o GitHub Actions, no
desde una vista del dashboard (para no depender de que el servicio de ML
esté despierto en el momento exacto en que alguien mira el dashboard):

- `python manage.py generar_alertas_stock` — HU31, no usa el túnel.
- `python manage.py sincronizar_alertas_ml` — HU22, HU29, trae riesgo y
  anomalías del servicio de ML y las convierte en alertas.
- `python manage.py generar_reabastecimiento` — HU26, genera órdenes a
  partir del riesgo alto.

## Estructura

```
config/         settings, urls, wsgi/asgi
usuarios/       HU12, HU35, HU38 — auth, roles, permisos, usuarios
productos/      HU01-HU05 — categorías, unidades, productos
inventario/     HU06-HU09 — lotes y movimientos de stock
ventas/         HU10-HU11 — ventas e importación masiva
operaciones/    HU23-HU24, HU26 — umbrales y reabastecimiento
alertas/        HU28-HU32 — alertas y notificaciones por correo
reportes/       HU33-HU34, HU37, HU39 — exportación, KPIs, preferencias
auditoria/      HU36 — registro automático de acciones (señales de Django)
ml_client/      el túnel: único punto de contacto con el servicio de ML
```
