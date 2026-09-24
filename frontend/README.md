# StockIA — Frontend (React 19 + Vite + TypeScript + Tailwind 4)

[![React](https://img.shields.io/badge/React-19-61dafb?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite)](https://vite.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)
[![TanStack Query](https://img.shields.io/badge/TanStack%20Query-5-ff4154?logo=reactquery)](https://tanstack.com/query)
[![License](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)

---

## Tabla de contenidos

- [Descripción](#descripción)
- [Tecnologías](#tecnologías)
- [Requisitos previos](#requisitos-previos)
- [Instalación](#instalación)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Convenciones](#convenciones)
- [Variables de entorno](#variables-de-entorno)
- [Scripts disponibles](#scripts-disponibles)
- [Pantallas implementadas](#pantallas-implementadas)
- [Backend relacionado](#backend-relacionado)

---

## Descripción

Frontend del sistema **StockIA** — gestión de inventario, ventas, alertas y reportes. Interfaz basada en el prototipo Figma "ProyectoHU", conectada al backend **Node.js + Express + Sequelize** (`../backend`).

---

## Tecnologías

| Tecnología | Versión | Uso |
|-----------|---------|-----|
| React | ^19.2.8 | UI library |
| Vite | ^8.3.0 | Build tool & dev server |
| TypeScript | ~6.0.2 | Tipado estático |
| Tailwind CSS | ^4.3.3 | Estilos (utility-first) |
| @tanstack/react-query | ^5.103.2 | Server state, caching, mutations |
| react-router | ^8.4.0 | Routing SPA |
| react-hook-form | ^7.88.0 | Formularios |
| zod | ^4.6.5 | Validación de esquemas |
| @hookform/resolvers | ^5.9.1 | Integración RHF + Zod |
| Radix UI | ^1.1-2.1 | Primitivos accesibles (Dialog, Select, Dropdown, Tabs) |
| lucide-react | ^1.46.0 | Iconos |
| sonner | ^2.0.8 | Toasts/notificaciones |
| recharts | ^3.10.1 | Gráficos |
| class-variance-authority | ^0.7.1 | Variantes de componentes |
| oxlint | ^1.81.0 | Linting rápido |

---

## Requisitos previos

- Node.js >= 18.x
- npm >= 9.x
- Backend corriendo en `http://localhost:3000` (ver `../backend/README.md`)

---

## Instalación

```bash
# 1. Ingresar al frontend
cd frontend

# 2. Instalar dependencias
npm install

# 3. Configurar entorno
cp .env.example .env
# Ajustar VITE_API_URL si el backend no está en localhost:3000

# 4. Iniciar desarrollo
npm run dev
```

Aplicación en `http://localhost:5173`

---

## Estructura del proyecto

```
frontend/
├── src/
│   ├── lib/                    # Cliente HTTP (JWT + refresh), TanStack Query client
│   ├── types/index.ts          # Tipos sincronizados con DTOs del backend
│   ├── auth/                   # AuthContext, Login, Recuperar password, Google OAuth, guard de rutas
│   ├── layout/                 # AppShell, Sidebar, Topbar (shell de pantallas internas)
│   ├── components/ui/          # Primitivos reutilizables (Button, Input, Select, Dialog, Table, Badge, Toast, etc.)
│   └── features/               # Una carpeta por pantalla (nombrada como frame en Figma)
│       ├── inicio/             # HU37 — Dashboard/resumen
│       ├── productos/          # HU01-HU05 — Listado, búsqueda, filtros, paginación, alta, edición, activar/desactivar
│       ├── inventario/         # HU06-HU09 — Lotes, historial, registrar movimiento
│       ├── kardex/             # HU09 — Kardex con filtros avanzados
│       ├── ventas/             # HU10-HU11 — Listado (registro e importación pendientes)
│       ├── prediccion/         # HU14, HU19-HU21, HU25-HU26 — Placeholder
│       ├── modelo-ml/          # HU15-HU18, HU22 — Placeholder
│       ├── configuracion/      # HU23, HU24, HU32, HU39 — Placeholder
│       ├── usuarios/           # HU35 — Parcial (crea Encargado Inventario, falta selector rol)
│       └── auditoria/          # HU36 — Placeholder
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── vite.config.ts
├── oxlint.json
├── index.html
└── README.md
```

Cada `features/<nombre>/` contiene:
- `<Nombre>Page.tsx` — página principal
- `api.ts` — hooks TanStack Query (`useProductos`, `useLotes`, `useMovimientos`, etc.)
- Componentes propios (modales, filas, formularios)

---

## Convenciones

- **Cliente HTTP**: usar exclusivamente `api` de `@/lib/api` (`api.get`, `post`, `patch`, `put`, `del`). No `fetch` directo.
- **Formularios**: `react-hook-form` + `zodResolver` (ver `EditarProductoModal`, `NuevoLoteModal`, `RegistrarMovimientoModal`).
- **Tipos**: `types/index.ts` refleja DTOs del backend. Si el backend cambia, actualizar aquí.
- **Permisos**: páginas envueltas en `RequirePermiso`; hooks asumen validación en backend.
- **Componentes UI**: basados en Radix + Tailwind + CVA, en `components/ui/`.

---

## Variables de entorno

| Variable | Descripción | Default |
|----------|-------------|---------|
| `VITE_API_URL` | URL base de la API backend | `http://localhost:3000/api` |

Ver `.env.example`.

---

## Scripts disponibles

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor desarrollo con HMR |
| `npm run build` | Compila TypeScript + build producción en `dist/` |
| `npm run lint` | Linting con oxlint |
| `npm run preview` | Sirve build de `dist/` localmente |

---

## Pantallas implementadas

| Pantalla | HU | Estado |
|----------|-----|--------|
| Inicio / Dashboard | HU37 | ✅ Completa |
| Productos | HU01-HU05 | ✅ Completa (CRUD, stock, activar/desactivar) |
| Inventario (Lotes) | HU06-HU09 | ✅ Completa (listado, nuevo lote, historial, movimiento) |
| Kardex | HU09 | ✅ Completa (filtros, paginación) |
| Ventas | HU10-HU11 | ⚠️ Solo listado |
| Predicción | HU14, HU19-HU21, HU25-HU26 | 🔲 Placeholder |
| Modelo ML | HU15-HU18, HU22 | 🔲 Placeholder |
| Configuración | HU23, HU24, HU32, HU39 | 🔲 Placeholder |
| Usuarios | HU35 | ⚠️ Parcial (falta selector de rol) |
| Auditoría | HU36 | 🔲 Placeholder |

---

## Backend relacionado

| Recurso | URL |
|---------|-----|
| API Base | `http://localhost:3000/api` |
| Swagger UI | `http://localhost:3000/api-docs` |
| Documentación backend | `../backend/README.md` |

---

## Licencia

ISC