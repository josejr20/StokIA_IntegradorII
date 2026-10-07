# StockIA Backend

API RESTful para gestión de inventario con arquitectura MVC + DTO, autenticación JWT, integración ML y documentación Swagger.

## Requisitos

- Node.js 18+
- PostgreSQL 15+
- npm 9+

## Variables de entorno

Copiar `.env.example` a `.env` y ajustar:

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `PORT` | Puerto del servidor | `3000` |
| `DB_HOST` | Host PostgreSQL | `localhost` |
| `DB_PORT` | Puerto PostgreSQL | `5432` |
| `DB_NAME` | Nombre de base de datos | `stockia` |
| `DB_USER` | Usuario PostgreSQL | `postgres` |
| `DB_PASSWORD` | Contraseña PostgreSQL | `secret` |
| `JWT_SECRET` | Secreto para firmar tokens | `clave-secreta-larga` |
| `JWT_EXPIRES_IN` | Expiración access token | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Expiración refresh token | `7d` |
| `SMTP_HOST` | Servidor SMTP | `smtp.gmail.com` |
| `SMTP_PORT` | Puerto SMTP | `587` |
| `SMTP_USER` | Usuario SMTP | `correo@dominio.com` |
| `SMTP_PASS` | Contraseña SMTP | `app-password` |
| `FRONTEND_URL` | URL del frontend para CORS | `http://localhost:5173` |

## Instalación

```bash
cd backend
npm install
```

## Base de datos

### Esquema automático (development)

```bash
npm run seed
```

Ejecuta `src/utils/seed.js` que a su vez invoca `seedService.seedInicial()` para crear:
- Permisos y roles base (Administrador, Encargado de Inventario, Encargado de Almacén, Jefe de Ventas)
- Unidades de medida
- Tipos de envase

### Esquema SQL (producción / migraciones)

Para una base nueva, usar este orden real de carga:

1. `postgresql/BackupStokIAV3.sql` — esquema base y datos principales
2. `postgresql/manual/05_importaciones_ventas.sql` — permisos y soporte de importación de ventas
3. `npm run seed` — permisos, roles y catálogos base del sistema

> **Nota:** Este orden es el que deja la base compatible con el código actual. Si se ejecuta solo el dump, faltarán columnas/permisos requeridos por `POST /api/ventas/importar` y por el bootstrap del módulo de ventas.

## Scripts disponibles

| Comando | Descripción |
|---------|-------------|
| `npm start` | Inicia servidor en producción (`server.js`) |
| `npm run dev` | Inicia servidor en desarrollo (`server.js`) |
| `npm run seed` | Sembrar datos iniciales (roles, permisos, catálogos) |
| `npm test` | Ejecuta suite de tests (`node --test tests/*.test.js`) |

## Endpoints principales

- `POST /api/auth/login` — Login, devuelve access + refresh token (cookies HttpOnly)
- `POST /api/auth/refresh` — Renueva access token
- `GET /api/productos` — Listar productos (paginado, filtros)
- `POST /api/productos` — Crear producto
- `GET /api/lotes` — Listar lotes con stock
- `POST /api/operaciones` — Registrar operación (entrada/salida/ajuste/devolución)
- `GET /api/kardex/:productoId` — Kardex de un producto
- `POST /api/importar-kardex` — Importar kardex histórico desde Excel
- `GET /api/reportes/*` — Reportes y KPIs
- `GET /api/alertas` — Alertas de stock bajo / vencimiento

Documentación completa en Swagger UI: `http://localhost:3000/api-docs`

## Autenticación y permisos

- JWT en cookie HttpOnly (`access_token`) + refresh token rotativo (`refresh_token`)
- Middleware `permission('codigo_permiso')` protege rutas según rol
- Roles y permisos se gestionan en `/api/roles` y `/api/permisos`

## Estructura del proyecto

```
src/
├── config/         # Configuración DB, Swagger
├── controllers/    # Controladores (request/response)
├── dtos/           # Data Transfer Objects + validación Zod
├── middleware/     # Auth, permisos, rate-limit, auditoría, errores
├── models/         # Modelos Sequelize + asociaciones
├── routes/         # Definición de rutas Express
├── services/       # Lógica de negocio
├── utils/          # Logger, JWT, seed, helpers
└── app.js          # App Express + middlewares globales
```

## Tests

```bash
npm test
```

Incluye:
- Tests de autenticación y rate-limit
- Tests de productos, lotes, operaciones, kardex
- Test de humo `routes-smoke.test.js` que verifica que todas las rutas cargan sin dependencias faltantes

## Notas de seguridad

- `xlsx@0.18.5` tiene advisories conocidos (prototype pollution en parser). Los archivos los sube usuario autenticado con límite 10 MB; riesgo acotado. Evaluar migración a `exceljs` o uso de CDN oficial SheetJS en futuras versiones.
- Contraseñas hasheadas con bcrypt (cost 10)
- Tokens JWT con expiración corta + refresh rotativo
- Rate-limit en `/auth/login` y endpoints sensibles
- Auditoría automática en operaciones críticas

## Despliegue

1. Configurar variables de entorno en servidor
2. Ejecutar scripts SQL en orden (ver sección Base de datos)
3. `npm ci && npm run seed` (opcional si ya corrieron SQL)
4. `npm start` (recomendado detrás de PM2 / systemd / Docker)
5. Configurar reverse proxy (Nginx) + TLS