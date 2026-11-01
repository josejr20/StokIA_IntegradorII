# Plan de Tests StockIA

## Estructura
- backend/tests/unit
- backend/tests/integration
- backend/tests/api
- backend/tests/fixtures
- backend/tests/helpers
- frontend/tests/unit, components, integration
- tests/e2e/smoke, auth, forms, crud, inventory, sales, regression, ml

## Tests a implementar (1 por uno)

### Backend Unit
1. [x] passwordPolicy.test.js - validación de contraseña
2. [x] jwt utils - generar/verificar token
3. dto transforms

### Backend Integration (PostgreSQL temporal)
4. modelos Sequelize - relaciones
5. restricciones integridad FK
6. transacciones venta

### Backend API (Supertest/node:test)
7. [x] auth login endpoint responds
8. auth rutas protegidas
9. usuarios CRUD
10. roles/permisos
11. [x] categorias endpoint responds
12. [x] productos endpoint responds
13. [x] lotes endpoint responds
14. [x] movimientos endpoint responds
15. [x] ventas endpoint responds
16. [x] alertas endpoint responds
17. seguridad inyección SQL

### Frontend Unit
18. [x] frontend unit smoke scaffold
19. filtros/paginación

### Frontend Components
20. inputs, modales, tablas

### E2E Playwright
21. [x] smoke disponibilidad (health endpoint)
22. auth login/logout
23. formularios validación
24. CRUD cada módulo
25. inventario paginación/filtros
26. ventas flujo
27. ML (si integrado)

### Seguridad/Rendimiento
28. [x] security workflow
29. [x] performance workflow
30. JMeter endpoints

## Campos tocados
- .env.test (aislamiento)
- backend/tests/*
- frontend/tests/*
- tests/e2e/*
- .github/workflows/*
