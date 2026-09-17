# StockIA — Frontend (frontend)

React + Vite + TypeScript + Tailwind, conectado a `backend-api` (Django).
Las once pantallas están mapeadas 1 a 1 al prototipo de Figma "ProyectoHU".

## Primeros pasos

```bash
npm install
cp .env.example .env      # ajusta VITE_API_URL si el backend no está en localhost:8000
npm run dev
```

Abre `http://localhost:5173`. Necesitas `backend-api` corriendo en paralelo
(`python manage.py runserver`) para poder loguearte.

## Scripts

- `npm run dev` — servidor de desarrollo con recarga en caliente.
- `npm run build` — compila TypeScript y arma el build de producción en `dist/`.
- `npm run lint` — oxlint (linter incluido en la plantilla de Vite).
- `npm run preview` — sirve el build de `dist/` localmente, para probarlo antes de desplegar.

## Estructura

```
src/
├── lib/            cliente HTTP (JWT + refresh automático), query client
├── types/          tipos que reflejan los serializers de Django
├── auth/           AuthContext, Login (HU12), Recuperar contraseña (HU38), guard de rutas
├── layout/         Sidebar, Topbar, AppShell (el shell de las 10 pantallas internas)
├── components/ui/  primitivos (botón, input, modal, drawer, tabla, select, dropdown, toast)
└── features/       una carpeta por pantalla, nombrada igual que el frame en Figma
    ├── inicio/          HU37
    ├── dashboard/       HU27-HU31, HU34
    ├── productos/       HU01-HU05
    ├── inventario/      HU06-HU09
    ├── ventas/          HU10-HU11
    ├── prediccion/      HU14, HU19-HU21, HU25, HU26
    ├── modelo-ml/       HU15-HU18, HU22
    ├── configuracion/   HU23, HU24, HU32, HU39
    ├── usuarios/        HU35
    └── auditoria/       HU36
```

Cada carpeta de `features/` va a tener, según se vaya construyendo: la página
(`<Nombre>Page.tsx`), sus hooks de datos (`api.ts` con TanStack Query) y sus
propios componentes (modales, filas de tabla, formularios).
