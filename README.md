# StockIA — VLAG Integrador II

[![GitHub](https://img.shields.io/badge/GitHub-repositorio-181717?logo=github)](https://github.com/josejr20/VLAG_IntegradorII)
[![Estado](https://img.shields.io/badge/estado-en%20desarrollo-yellow)](https://github.com/josejr20/VLAG_IntegradorII)
[![Python](https://img.shields.io/badge/Python-3.12-blue?logo=python)](https://www.python.org/)
[![Django](https://img.shields.io/badge/Django-5.0-092E20?logo=django)](https://www.djangoproject.com/)
[![React](https://img.shields.io/badge/React-19.2.8-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?logo=vite)](https://vite.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-336791?logo=postgresql)](https://www.postgresql.org/)

Sistema de gestión de stock, ventas, inventario, alertas y predicción de demanda. El repositorio contiene una API de negocio construida con **Django + Django REST Framework** y una interfaz web construida con **React + Vite + TypeScript + Tailwind CSS**.

El prototipo de referencia es [ProyectoHU en Figma](https://www.figma.com/design/HpMUPCclEz1rkwwlTXlLeM/ProyectoHU?node-id=0-1&t=VybrJedhxzrODj1W-1).

## Estructura del repositorio

```text
VLAG_IntegradorII/
├── BACKEND/
│   └── stockia-backend-api/
│       └── backend-api/          # API Django/DRF
│           ├── config/           # configuración, URLs, WSGI/ASGI
│           ├── usuarios/         # autenticación, roles, permisos y usuarios
│           ├── productos/        # catálogo de productos
│           ├── inventario/       # lotes e inventario
│           ├── ventas/           # ventas e importación
│           ├── operaciones/      # umbrales y reabastecimiento
│           ├── alertas/          # alertas y notificaciones
│           ├── reportes/         # KPIs, inicio, Excel y preferencias
│           ├── auditoria/        # trazabilidad de acciones
│           └── ml_client/        # cliente hacia el servicio externo de ML
├── frontend/                     # aplicación React
│   ├── src/auth/                 # sesión, recuperación y rutas protegidas
│   ├── src/layout/               # sidebar, topbar y shell de la aplicación
│   ├── src/components/ui/        # componentes reutilizables
│   └── src/features/             # módulos por pantalla/HU
└── db/
    ├── init/                     # esquemas, tablas ML y roles de PostgreSQL
    └── manual/                   # grants que se ejecutan después de migrate
```

## Estado actual

### Backend

La API de negocio está organizada por módulos y actualmente contempla:

- Autenticación JWT, recuperación de contraseña, roles y permisos.
- Productos, categorías, unidades de medida, presentaciones y lotes.
- Ventas manuales e importación de ventas.
- Umbrales, órdenes de reabastecimiento y alertas de stock.
- KPIs, página de inicio, exportación de inventario a Excel y preferencias.
- Auditoría automática de operaciones.
- Cliente HTTP (`ml_client`) para consultar predicciones, riesgos, anomalías y reentrenamiento al servicio externo de Machine Learning.

La base de datos usa PostgreSQL con separación de esquemas:

- `negocio`: tablas administradas por Django mediante migraciones.
- `ml`: tablas del servicio de Machine Learning.
- La API de negocio no consulta directamente las tablas `ml`; las solicita al servicio externo mediante el cliente indicado arriba.

El servicio FastAPI de ML es un componente separado y **no se encuentra incluido en este repositorio**. El backend puede ejecutarse sin él, pero las funcionalidades que dependen de ML quedarán sin datos mientras el servicio no esté disponible.

### Frontend

La aplicación ya cuenta con:

- Router protegido y shell principal con sidebar/topbar.
- Inicio de sesión y contexto de autenticación.
- Cliente HTTP centralizado con JWT, refresh de token y redirección al expirar la sesión.
- TanStack Query para consumo de la API.
- Componentes UI reutilizables y estilos con Tailwind CSS.
- Módulo de productos funcional: listado, búsqueda, filtros, alta, edición, desactivación y reactivación.

Las siguientes rutas ya están registradas, pero sus pantallas siguen marcadas como pendientes de construcción en el código actual: Inicio, Dashboard, Lotes e inventario, Ventas, Predicción y riesgo, Modelo ML, Configuración, Usuarios y Auditoría. La recuperación de contraseña también se encuentra en estado inicial.

No se encontró una suite de pruebas registrada actualmente en `frontend` ni en `backend-api`.

## Requisitos previos

- Python 3.12.
- Node.js compatible con Vite 8 (Node.js 20.19+ o 22.12+).
- npm.
- PostgreSQL local o una instancia de Supabase.
- Git.

No subir archivos de ambiente ni dependencias locales: `.env`, `venv/`, `node_modules/` y `dist/` deben permanecer fuera del repositorio.

## Configuración de la base de datos

Los scripts de PostgreSQL del repositorio crean los esquemas, las tablas del servicio ML, los roles y los permisos iniciales. Si la base ya está configurada, este paso puede omitirse.

1. Crear la base de datos, si corresponde:

   ```bash
   createdb -U postgres stockia
   ```

2. Ejecutar una sola vez el bootstrap:

   ```bash
   psql -U postgres -d stockia -f db/init/01_schema_ml_y_roles.sql
   ```

3. Después de aplicar las migraciones del backend, ejecutar el grant que concede solo lectura al servicio ML sobre las tablas de negocio:

   ```bash
   psql -U postgres -d stockia -f db/manual/02_grant_lectura_ml.sql
   ```

En Supabase, los mismos archivos SQL pueden ejecutarse desde el SQL Editor. El segundo script debe correrse después de que Django haya creado `negocio.productos`, `negocio.lotes` y `negocio.ventas`.

## Ejecución del backend

Abrir una terminal en la raíz del backend:

```bash
cd BACKEND/stockia-backend-api/backend-api
```

Crear y activar el entorno virtual:

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

En PowerShell, si la política de ejecución bloquea el script, usar:

```powershell
.\venv\Scripts\activate.bat
```

Instalar dependencias:

```bash
pip install -r requirements.txt
```

Crear un archivo `.env` en `backend-api/` con las variables requeridas por [`config/settings.py`](BACKEND/stockia-backend-api/backend-api/config/settings.py). Como referencia, el backend utiliza:

```dotenv
DJANGO_SECRET_KEY=
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
DB_NAME=stockia
DB_USER=business_api_role
DB_PASSWORD=
DB_HOST=localhost
DB_PORT=5432
CORS_ALLOWED_ORIGINS=http://localhost:5173
ML_SERVICE_URL=http://localhost:8001
ML_SERVICE_TOKEN=
BREVO_API_KEY=
BREVO_SENDER_EMAIL=alertas@stockia.local
FRONTEND_URL=http://localhost:5173
```

Aplicar migraciones, cargar datos iniciales y crear un administrador:

```bash
python manage.py migrate
python manage.py seed_inicial
python manage.py createsuperuser
```

Comprobar la configuración y ejecutar la API:

```bash
python manage.py check
python manage.py runserver
```

La API queda disponible en:

- API: <http://localhost:8000/api/>
- Django Admin: <http://localhost:8000/admin/>

Comandos operativos disponibles:

```bash
python manage.py generar_alertas_stock
python manage.py sincronizar_alertas_ml
python manage.py generar_reabastecimiento
```

Estos comandos están pensados para ejecutarse mediante un job programado, cron o GitHub Actions, no desde una vista del dashboard.

## Ejecución del frontend

Abrir otra terminal en la carpeta del frontend:

```bash
cd frontend
npm install
```

Copiar el ambiente de ejemplo:

```powershell
Copy-Item .env.example .env
```

El valor por defecto de `VITE_API_URL` es `http://localhost:8000/api`. Cambiarlo en `.env` si la API se encuentra en otra dirección.

Iniciar el servidor de desarrollo:

```bash
npm run dev
```

Abrir:

- Frontend: <http://localhost:5173>

Comandos disponibles:

```bash
npm run build     # compila TypeScript y genera dist/
npm run lint      # ejecuta oxlint
npm run preview   # sirve localmente la compilación de producción
```

## Flujo de desarrollo recomendado

1. Iniciar PostgreSQL y verificar que los esquemas/roles existan.
2. Iniciar el backend y aplicar migraciones si hubo cambios en los modelos.
3. Iniciar el frontend en paralelo.
4. Usar una cuenta creada con `createsuperuser` o una cuenta del flujo de usuarios para probar la interfaz.
5. Si se trabaja con ML, iniciar además el servicio externo en `ML_SERVICE_URL`.
6. Ejecutar `python manage.py check` y `npm run build` antes de integrar cambios.

## Flujo de la aplicación

```text
React/Vite
  ├── rutas protegidas
  ├── AuthContext + JWT
  ├── cliente HTTP centralizado
  └── TanStack Query
          │
          ▼
Django REST Framework
  ├── PostgreSQL / esquema negocio
  ├── roles y permisos
  ├── auditoría
  └── ml_client
          │
          ▼
Servicio externo de Machine Learning
  └── esquema ml / modelos / predicciones
```

## Consideraciones de seguridad

- Mantener fuera de Git cualquier `.env`, token, contraseña o clave de proveedor.
- Reemplazar las credenciales locales de los scripts SQL antes de usar el proyecto en un entorno real.
- Restringir `DJANGO_ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS` y los orígenes del frontend en producción.
- Configurar `DJANGO_DEBUG=False` en producción.
- Usar almacenamiento externo para imágenes y archivos cuando el proyecto se despliegue.

## Enlaces útiles

- [Backend: documentación específica](BACKEND/stockia-backend-api/backend-api/README.md)
- [Frontend: documentación específica](frontend/README.md)
- [Repositorio en GitHub](https://github.com/josejr20/VLAG_IntegradorII)
