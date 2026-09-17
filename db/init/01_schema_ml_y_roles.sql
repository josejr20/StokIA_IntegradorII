-- ============================================================================
-- StockIA — bootstrap para Postgres local (Docker)
-- Esto es lo unico que se crea "a mano": los esquemas, las tablas del
-- servicio de ML, los roles de base de datos y sus permisos.
-- Las tablas del esquema "negocio" las crea Django con sus migraciones
-- (ver backend-api/README.md) para que el modelo en Python y la tabla real
-- nunca queden desincronizados.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS negocio;
CREATE SCHEMA IF NOT EXISTS ml;

-- ============================================================================
-- Tablas del servicio de ML (HU13-HU22, HU25)
-- ============================================================================

CREATE TABLE ml.conjuntos_datos (
    id SERIAL PRIMARY KEY,
    descripcion VARCHAR(200),
    filas INTEGER,
    rango_desde DATE,
    rango_hasta DATE,
    fecha_preparacion TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE ml.conjuntos_datos IS 'HU13: registro de cada preparación de datos históricos usada para entrenar el modelo';

CREATE TABLE ml.modelos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    tipo VARCHAR(50) NOT NULL,
    version VARCHAR(50) NOT NULL,
    metricas JSONB,
    ruta_artefacto VARCHAR(255),
    estado VARCHAR(20) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'archivado')),
    fecha_entrenamiento TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE ml.modelos IS 'HU15-HU18: versiones del modelo de predicción, con sus métricas MAE y RMSE en metricas';

CREATE TABLE ml.entrenamientos (
    id SERIAL PRIMARY KEY,
    modelo_id INTEGER REFERENCES ml.modelos(id),
    iniciado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    finalizado_en TIMESTAMPTZ,
    estado VARCHAR(20) NOT NULL DEFAULT 'en_progreso' CHECK (estado IN ('en_progreso', 'completado', 'fallido')),
    metricas JSONB,
    detalle TEXT
);
COMMENT ON TABLE ml.entrenamientos IS 'HU16, HU18: historial de corridas de entrenamiento y reentrenamiento';

CREATE TABLE ml.predicciones_demanda (
    id BIGSERIAL PRIMARY KEY,
    producto_id INTEGER NOT NULL,
    modelo_id INTEGER REFERENCES ml.modelos(id),
    horizonte_dias INTEGER NOT NULL,
    cantidad_predicha NUMERIC(12,2) NOT NULL,
    intervalo_inferior NUMERIC(12,2),
    intervalo_superior NUMERIC(12,2),
    fecha_prediccion DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE ml.predicciones_demanda IS 'HU14, HU28: predicciones de demanda por producto. producto_id no lleva FK a negocio.productos a propósito: el túnel resuelve esa referencia por API, nunca por join directo entre esquemas';
CREATE INDEX idx_predicciones_producto ON ml.predicciones_demanda(producto_id, fecha_prediccion DESC);

CREATE TABLE ml.riesgos_vencimiento (
    id BIGSERIAL PRIMARY KEY,
    producto_id INTEGER NOT NULL,
    lote_id INTEGER,
    puntaje_riesgo NUMERIC(5,4) NOT NULL CHECK (puntaje_riesgo BETWEEN 0 AND 1),
    nivel_prioridad VARCHAR(20) NOT NULL CHECK (nivel_prioridad IN ('bajo', 'medio', 'alto')),
    dias_para_vencer INTEGER,
    factores JSONB,
    fecha_calculo TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE ml.riesgos_vencimiento IS 'HU19-HU20, HU29: puntaje de riesgo y prioridad por producto/lote';
CREATE INDEX idx_riesgos_producto ON ml.riesgos_vencimiento(producto_id, fecha_calculo DESC);

CREATE TABLE ml.recomendaciones (
    id SERIAL PRIMARY KEY,
    producto_id INTEGER NOT NULL,
    tipo VARCHAR(50) NOT NULL,
    descripcion TEXT NOT NULL,
    prioridad VARCHAR(20) NOT NULL CHECK (prioridad IN ('baja', 'media', 'alta')),
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'atendida', 'descartada')),
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE ml.recomendaciones IS 'HU21: recomendaciones para productos prioritarios';

CREATE TABLE ml.anomalias (
    id BIGSERIAL PRIMARY KEY,
    tipo VARCHAR(50) NOT NULL,
    entidad VARCHAR(30) NOT NULL CHECK (entidad IN ('venta', 'lote', 'producto')),
    entidad_id INTEGER NOT NULL,
    descripcion TEXT NOT NULL,
    severidad VARCHAR(20) NOT NULL DEFAULT 'media' CHECK (severidad IN ('baja', 'media', 'alta')),
    estado VARCHAR(20) NOT NULL DEFAULT 'nueva' CHECK (estado IN ('nueva', 'revisada', 'descartada')),
    fecha_deteccion TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE ml.anomalias IS 'HU22: anomalías detectadas en ventas e inventario';

-- ============================================================================
-- Roles de base de datos — el túnel reforzado a nivel de PostgreSQL
-- En local las claves no importan tanto, pero igual conviene no dejarlas así
-- cuando esto se mueva a Supabase.
-- ============================================================================

CREATE ROLE business_api_role LOGIN PASSWORD 'business_local_pw';
CREATE ROLE ml_service_role LOGIN PASSWORD 'ml_local_pw';

-- API de negocio: dueña de su esquema, incluido el permiso de CREAR tablas
-- (lo necesita Django para correr "migrate" y armar el esquema negocio).
GRANT USAGE, CREATE ON SCHEMA negocio TO business_api_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA negocio TO business_api_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA negocio TO business_api_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA negocio GRANT ALL ON TABLES TO business_api_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA negocio GRANT ALL ON SEQUENCES TO business_api_role;

-- Servicio de ML: dueño de su esquema.
GRANT USAGE, CREATE ON SCHEMA ml TO ml_service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA ml TO ml_service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA ml TO ml_service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA ml GRANT ALL ON TABLES TO ml_service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA ml GRANT ALL ON SEQUENCES TO ml_service_role;

-- El servicio de ML necesita leer productos/lotes/ventas para entrenar y
-- calcular riesgo, pero esas tablas todavía no existen en este punto (las
-- crea Django después). Por eso ese GRANT específico vive en
-- db/manual/02_grant_lectura_ml.sql y se corre a mano, una sola vez,
-- después del primer "python manage.py migrate".
GRANT USAGE ON SCHEMA negocio TO ml_service_role;

-- La API de negocio NO recibe ningún permiso sobre el esquema ml.
