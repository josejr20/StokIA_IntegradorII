-- ============================================================================
-- StockIA — esquema para PostgreSQL local
-- Tablas del esquema negocio (equivalentes a los modelos Django)
-- Tablas del esquema ml (servicio de ML)
-- Roles y permisos de base de datos
-- ============================================================================
create database StockIA

CREATE SCHEMA IF NOT EXISTS negocio;
CREATE SCHEMA IF NOT EXISTS ml;

-- ============================================================================
-- Esquema negocio — Tablas
-- ============================================================================

-- AUTHENTICATION & AUTHORIZATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS negocio.roles (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) UNIQUE NOT NULL,
    descripcion TEXT,
    fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE negocio.roles IS 'Roles del sistema (Administrador, Encargado de Inventario, etc.)';

CREATE TABLE IF NOT EXISTS negocio.permisos (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(80) UNIQUE NOT NULL,
    descripcion TEXT
);
COMMENT ON TABLE negocio.permisos IS 'Permisos disponibles del sistema';

CREATE TABLE IF NOT EXISTS negocio.rol_permisos (
    rol_id INTEGER NOT NULL REFERENCES negocio.roles(id) ON DELETE CASCADE,
    permiso_id INTEGER NOT NULL REFERENCES negocio.permisos(id) ON DELETE CASCADE,
    PRIMARY KEY (rol_id, permiso_id)
);
COMMENT ON TABLE negocio.rol_permisos IS 'Relación N:N entre roles y permisos';

CREATE TABLE IF NOT EXISTS negocio.usuarios (
    id SERIAL PRIMARY KEY,
    password VARCHAR(128),
    password_hash VARCHAR(128),
    nombre VARCHAR(150) NOT NULL,
    email VARCHAR(254) UNIQUE NOT NULL,
    rol_id INTEGER NOT NULL REFERENCES negocio.roles(id) ON DELETE RESTRICT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW(),
    ultimo_acceso TIMESTAMP,
    is_staff BOOLEAN NOT NULL DEFAULT FALSE,
    google_id VARCHAR(255) UNIQUE,
    avatar VARCHAR(500),
    provider VARCHAR(30) NOT NULL DEFAULT 'local',
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    last_login TIMESTAMP
);
COMMENT ON TABLE negocio.usuarios IS 'Usuarios del sistema (auth custom con email)';
CREATE INDEX idx_usuarios_email ON negocio.usuarios(email);
CREATE INDEX idx_usuarios_rol ON negocio.usuarios(rol_id);

CREATE TABLE IF NOT EXISTS negocio.tokens_recuperacion (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES negocio.usuarios(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE,
    code_hash VARCHAR(255),
    intentos INTEGER NOT NULL DEFAULT 0,
    expira_en TIMESTAMP NOT NULL,
    usado BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE negocio.tokens_recuperacion IS 'Tokens para recuperación de contraseña';
CREATE INDEX idx_tokens_usuario ON negocio.tokens_recuperacion(usuario_id);

-- CATALOGOS DE PRODUCTOS
-- ============================================================================

CREATE TABLE IF NOT EXISTS negocio.categorias (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) UNIQUE NOT NULL,
    descripcion TEXT,
    vida_util_dias INTEGER,
    fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE negocio.categorias IS 'Categorías de productos';

CREATE TABLE IF NOT EXISTS negocio.unidades_medida (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) UNIQUE NOT NULL,
    abreviatura VARCHAR(10) NOT NULL
);
COMMENT ON TABLE negocio.unidades_medida IS 'Unidades de medida físicas';

CREATE TABLE IF NOT EXISTS negocio.presentaciones (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) UNIQUE NOT NULL,
    descripcion TEXT
);
COMMENT ON TABLE negocio.presentaciones IS 'Presentaciones de venta';

CREATE TABLE IF NOT EXISTS negocio.catalogo_marcas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) UNIQUE NOT NULL
);
COMMENT ON TABLE negocio.catalogo_marcas IS 'Marcas del catálogo de Excel';

CREATE TABLE IF NOT EXISTS negocio.catalogo_marcas_familias (
    marca_id INTEGER NOT NULL REFERENCES negocio.catalogo_marcas(id) ON DELETE CASCADE,
    categoria_id INTEGER NOT NULL REFERENCES negocio.categorias(id) ON DELETE CASCADE,
    PRIMARY KEY (marca_id, categoria_id)
);
COMMENT ON TABLE negocio.catalogo_marcas_familias IS 'Relación N:N marcas-categorías (familias)';

CREATE TABLE IF NOT EXISTS negocio.catalogo_valores (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(50) NOT NULL,
    valor VARCHAR(100) NOT NULL,
    etiqueta VARCHAR(100),
    UNIQUE(tipo, valor)
);
COMMENT ON TABLE negocio.catalogo_valores IS 'Valores genéricos de catálogo (material, color, etc.)';

-- PRODUCTOS
-- ============================================================================

CREATE TABLE IF NOT EXISTS negocio.productos (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(200) NOT NULL,
    categoria_id INTEGER REFERENCES negocio.categorias(id) ON DELETE SET NULL,
    unidad_medida_id INTEGER REFERENCES negocio.unidades_medida(id) ON DELETE SET NULL,
    presentacion_id INTEGER REFERENCES negocio.presentaciones(id) ON DELETE SET NULL,
    imagen VARCHAR(255),
    descripcion TEXT,
    marca_id INTEGER REFERENCES negocio.catalogo_marcas(id) ON DELETE SET NULL,
    precio_venta NUMERIC(10,2),
    caracteristicas JSONB DEFAULT '{}',
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    motivo_desactivacion VARCHAR(20),
    motivo_desactivacion_detalle VARCHAR(255),
    fecha_desactivacion TIMESTAMP,
    fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMP NOT NULL DEFAULT NOW(),
    contenido_valor NUMERIC(10,2) CHECK (contenido_valor >= 0),
    categoria_paquete_id INTEGER REFERENCES tipo_envase(id),
    contenido_paquete_cantidad NUMERIC(10,2) CHECK (contenido_paquete_cantidad IS NULL OR contenido_paquete_cantidad > 0),
    contenido_paquete_envase_id INTEGER REFERENCES tipo_envase(id),
    CONSTRAINT chk_producto_paquete_emparejado
        CHECK ((contenido_paquete_cantidad IS NULL) = (contenido_paquete_envase_id IS NULL))
);
COMMENT ON TABLE negocio.productos IS 'Catálogo de productos';
CREATE INDEX idx_productos_codigo ON negocio.productos(codigo);
CREATE INDEX idx_productos_categoria ON negocio.productos(categoria_id);
CREATE INDEX idx_productos_activo ON negocio.productos(activo);
CREATE INDEX IF NOT EXISTS idx_productos_categoria_paquete ON negocio.productos(categoria_paquete_id);
CREATE INDEX IF NOT EXISTS idx_productos_contenido_envase ON negocio.productos(contenido_paquete_envase_id);

-- INVENTARIO
-- ============================================================================

CREATE TABLE IF NOT EXISTS negocio.lotes (
    id SERIAL PRIMARY KEY,
    producto_id INTEGER NOT NULL REFERENCES negocio.productos(id) ON DELETE CASCADE,
    numero_lote VARCHAR(60) NOT NULL,
    cantidad_inicial NUMERIC(12,2) NOT NULL DEFAULT 0,
    cantidad_actual NUMERIC(12,2) NOT NULL DEFAULT 0,
    fecha_ingresso DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_vencimiento DATE NOT NULL,
    fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(producto_id, numero_lote)
);
COMMENT ON TABLE negocio.lotes IS 'Lotes de productos con vencimiento';
CREATE INDEX idx_lotes_producto ON negocio.lotes(producto_id);
CREATE INDEX idx_lotes_vencimiento ON negocio.lotes(fecha_vencimiento);

CREATE TABLE IF NOT EXISTS negocio.movimientos_inventario (
    id BIGSERIAL PRIMARY KEY,
    lote_id INTEGER NOT NULL REFERENCES negocio.lotes(id) ON DELETE CASCADE,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('ingreso', 'salida', 'ajuste')),
    origen VARCHAR(20) NOT NULL DEFAULT 'otro' CHECK (origen IN ('compra', 'venta', 'inicial', 'ajuste', 'otro')),
    cantidad NUMERIC(12,2) NOT NULL,
    precio_unitario NUMERIC(10,2),
    precio_total NUMERIC(12,2),
    saldo_cantidad NUMERIC(12,2) NOT NULL DEFAULT 0,
    saldo_precio_unitario NUMERIC(10,2) NOT NULL DEFAULT 0,
    saldo_valorizado NUMERIC(12,2) NOT NULL DEFAULT 0,
    motivo VARCHAR(200),
    usuario_id INTEGER REFERENCES negocio.usuarios(id) ON DELETE SET NULL,
    fecha TIMESTAMP NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE negocio.movimientos_inventario IS 'Kardex: historial de movimientos de stock';
CREATE INDEX idx_movimientos_lote ON negocio.movimientos_inventario(lote_id);
CREATE INDEX idx_movimientos_fecha ON negocio.movimientos_inventario(fecha);
CREATE INDEX idx_movimientos_producto ON negocio.movimientos_inventario(lote_id);

-- VENTAS
-- ============================================================================

CREATE TABLE IF NOT EXISTS negocio.ventas (
    id BIGSERIAL PRIMARY KEY,
    producto_id INTEGER NOT NULL REFERENCES negocio.productos(id) ON DELETE CASCADE,
    lote_id INTEGER REFERENCES negocio.lotes(id) ON DELETE SET NULL,
    cantidad NUMERIC(12,2) NOT NULL,
    precio_unitario NUMERIC(10,2) NOT NULL,
    fecha_venta DATE NOT NULL,
    origen VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (origen IN ('manual', 'importado')),
    usuario_id INTEGER REFERENCES negocio.usuarios(id) ON DELETE SET NULL,
    fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE negocio.ventas IS 'Registro de ventas';
CREATE INDEX idx_ventas_producto ON negocio.ventas(producto_id);
CREATE INDEX idx_ventas_fecha ON negocio.ventas(fecha_venta);

CREATE TABLE IF NOT EXISTS negocio.importaciones_ventas (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES negocio.usuarios(id) ON DELETE SET NULL,
    nombre_archivo VARCHAR(255) NOT NULL,
    filas_procesadas INTEGER NOT NULL DEFAULT 0,
    filas_con_error INTEGER NOT NULL DEFAULT 0,
    estado VARCHAR(20) NOT NULL DEFAULT 'procesando' CHECK (estado IN ('procesando', 'completado', 'fallido')),
    fecha TIMESTAMP NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE negocio.importaciones_ventas IS 'Importaciones masivas de ventas desde Excel/CSV';

-- OPERACIONES
-- ============================================================================

CREATE TABLE IF NOT EXISTS negocio.umbrales_configuracion (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('dias_vencimiento', 'stock_minimo')),
    producto_id INTEGER REFERENCES negocio.productos(id) ON DELETE CASCADE,
    valor NUMERIC(10,2) NOT NULL,
    usuario_id INTEGER REFERENCES negocio.usuarios(id) ON DELETE SET NULL,
    fecha_actualizacion TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(tipo, producto_id)
);
COMMENT ON TABLE negocio.umbrales_configuracion IS 'Umbrales de alerta por producto/tipo';

CREATE TABLE IF NOT EXISTS negocio.ordenes_reabastecimiento (
    id SERIAL PRIMARY KEY,
    producto_id INTEGER NOT NULL REFERENCES negocio.productos(id) ON DELETE CASCADE,
    cantidad_sugerida NUMERIC(12,2) NOT NULL,
    cantidad_aprobada NUMERIC(12,2),
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobada', 'rechazada', 'completada')),
    generado_por VARCHAR(20) NOT NULL DEFAULT 'automatico' CHECK (generado_por IN ('automatico', 'manual')),
    usuario_id INTEGER REFERENCES negocio.usuarios(id) ON DELETE SET NULL,
    fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMP NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE negocio.ordenes_reabastecimiento IS 'Órdenes de reabastecimiento';
CREATE INDEX idx_ordenes_estado ON negocio.ordenes_reabastecimiento(estado);

-- ALERTAS
-- ============================================================================

CREATE TABLE IF NOT EXISTS negocio.alertas (
    id BIGSERIAL PRIMARY KEY,
    tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('riesgo_vencimiento', 'bajo_stock', 'anomalia')),
    producto_id INTEGER NOT NULL REFERENCES negocio.productos(id) ON DELETE CASCADE,
    lote_id INTEGER REFERENCES negocio.lotes(id) ON DELETE SET NULL,
    mensaje TEXT NOT NULL,
    severidad VARCHAR(20) NOT NULL DEFAULT 'media' CHECK (severidad IN ('baja', 'media', 'alta', 'critica')),
    datos_origen JSONB,
    estado VARCHAR(20) NOT NULL DEFAULT 'nueva' CHECK (estado IN ('nueva', 'vista', 'atendida', 'descartada')),
    fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW(),
    fecha_atendida TIMESTAMP
);
COMMENT ON TABLE negocio.alertas IS 'Alertas del dashboard';
CREATE INDEX idx_alertas_producto ON negocio.alertas(producto_id);
CREATE INDEX idx_alertas_estado ON negocio.alertas(estado);
CREATE INDEX idx_alertas_severidad ON negocio.alertas(severidad);

CREATE TABLE IF NOT EXISTS negocio.notificaciones_correo (
    id BIGSERIAL PRIMARY KEY,
    alerta_id INTEGER REFERENCES negocio.alertas(id) ON DELETE SET NULL,
    destinatario VARCHAR(254) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'enviado', 'fallido')),
    proveedor VARCHAR(30) NOT NULL DEFAULT 'brevo',
    fecha_envio TIMESTAMP
);
COMMENT ON TABLE negocio.notificaciones_correo IS 'Registro de notificaciones por correo';

-- REPORTES Y PREFERENCIAS
-- ============================================================================

CREATE TABLE IF NOT EXISTS negocio.reportes_generados (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES negocio.usuarios(id) ON DELETE SET NULL,
    tipo VARCHAR(50) NOT NULL,
    formato VARCHAR(10) NOT NULL CHECK (formato IN ('excel', 'pdf')),
    parametros JSONB,
    ruta_archivo VARCHAR(255),
    fecha_generacion TIMESTAMP NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE negocio.reportes_generados IS 'Reportes generados por usuarios';

CREATE TABLE IF NOT EXISTS negocio.preferencias_usuario (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES negocio.usuarios(id) ON DELETE CASCADE,
    clave VARCHAR(80) NOT NULL,
    valor JSONB NOT NULL,
    fecha_actualizacion TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(usuario_id, clave)
);
COMMENT ON TABLE negocio.preferencias_usuario IS 'Preferencias de visualización por usuario';

-- AUDITORÍA
-- ============================================================================

CREATE TABLE IF NOT EXISTS negocio.auditoria (
    id BIGSERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES negocio.usuarios(id) ON DELETE SET NULL,
    accion VARCHAR(100) NOT NULL,
    entidad VARCHAR(80) NOT NULL,
    entidad_id INTEGER,
    detalle JSONB,
    fecha TIMESTAMP NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE negocio.auditoria IS 'Registro de auditoría';
CREATE INDEX idx_auditoria_entidad ON negocio.auditoria(entidad);
CREATE INDEX idx_auditoria_usuario ON negocio.auditoria(usuario_id);
CREATE INDEX idx_auditoria_fecha ON negocio.auditoria(fecha);

-- ============================================================================
-- Esquema ml — Tablas del servicio de Machine Learning
-- ============================================================================

CREATE TABLE IF NOT EXISTS ml.conjuntos_datos (
    id SERIAL PRIMARY KEY,
    descripcion VARCHAR(200),
    filas INTEGER,
    rango_desde DATE,
    rango_hasta DATE,
    fecha_preparacion TIMESTAMP NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE ml.conjuntos_datos IS 'HU13: registro de preparación de datos históricos';

CREATE TABLE IF NOT EXISTS ml.modelos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    tipo VARCHAR(50) NOT NULL,
    version VARCHAR(50) NOT NULL,
    metricas JSONB,
    ruta_artefacto VARCHAR(255),
    estado VARCHAR(20) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'archivado')),
    fecha_entrenamiento TIMESTAMP NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE ml.modelos IS 'HU15-HU18: versiones del modelo de predicción';

CREATE TABLE IF NOT EXISTS ml.entrenamientos (
    id SERIAL PRIMARY KEY,
    modelo_id INTEGER REFERENCES ml.modelos(id),
    iniciado_en TIMESTAMP NOT NULL DEFAULT NOW(),
    finalizado_en TIMESTAMP,
    estado VARCHAR(20) NOT NULL DEFAULT 'en_progreso' CHECK (estado IN ('en_progreso', 'completado', 'fallido')),
    metricas JSONB,
    detalle TEXT
);
COMMENT ON TABLE ml.entrenamientos IS 'HU16, HU18: historial de entrenamiento';

CREATE TABLE IF NOT EXISTS ml.predicciones_demanda (
    id BIGSERIAL PRIMARY KEY,
    producto_id INTEGER NOT NULL,
    modelo_id INTEGER REFERENCES ml.modelos(id),
    horizonte_dias INTEGER NOT NULL,
    cantidad_predicha NUMERIC(12,2) NOT NULL,
    intervalo_inferior NUMERIC(12,2),
    intervalo_superior NUMERIC(12,2),
    fecha_prediccion DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE ml.predicciones_demanda IS 'HU14, HU28: predicciones de demanda';
CREATE INDEX idx_predicciones_producto ON ml.predicciones_demanda(producto_id, fecha_prediccion DESC);

CREATE TABLE IF NOT EXISTS ml.riesgos_vencimiento (
    id BIGSERIAL PRIMARY KEY,
    producto_id INTEGER NOT NULL,
    lote_id INTEGER,
    puntaje_riesgo NUMERIC(5,4) NOT NULL CHECK (puntaje_riesgo BETWEEN 0 AND 1),
    nivel_prioridad VARCHAR(20) NOT NULL CHECK (nivel_prioridad IN ('bajo', 'medio', 'alto')),
    dias_para_vencer INTEGER,
    factores JSONB,
    fecha_calculo TIMESTAMP NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE ml.riesgos_vencimiento IS 'HU19-HU20, HU29: puntaje de riesgo';
CREATE INDEX idx_riesgos_producto ON ml.riesgos_vencimiento(producto_id, fecha_calculo DESC);

CREATE TABLE IF NOT EXISTS ml.recomendaciones (
    id SERIAL PRIMARY KEY,
    producto_id INTEGER NOT NULL,
    tipo VARCHAR(50) NOT NULL,
    descripcion TEXT NOT NULL,
    prioridad VARCHAR(20) NOT NULL CHECK (prioridad IN ('baja', 'media', 'alta')),
    estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'atendida', 'descartada')),
    fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE ml.recomendaciones IS 'HU21: recomendaciones prioritarias';

CREATE TABLE IF NOT EXISTS ml.anomalias (
    id BIGSERIAL PRIMARY KEY,
    tipo VARCHAR(50) NOT NULL,
    entidad VARCHAR(30) NOT NULL CHECK (entidad IN ('venta', 'lote', 'producto')),
    entidad_id INTEGER NOT NULL,
    descripcion TEXT NOT NULL,
    severidad VARCHAR(20) NOT NULL DEFAULT 'media' CHECK (severidad IN ('baja', 'media', 'alta')),
    estado VARCHAR(20) NOT NULL DEFAULT 'nueva' CHECK (estado IN ('nueva', 'revisada', 'descartada')),
    fecha_deteccion TIMESTAMP NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE ml.anomalias IS 'HU22: anomalías detectadas';

-- ============================================================================
-- Roles de base de datos
-- ============================================================================

CREATE ROLE business_api_role
WITH LOGIN PASSWORD 'business_local_pw';

CREATE ROLE ml_service_role
WITH LOGIN PASSWORD 'ml_local_pw';


GRANT USAGE, CREATE ON SCHEMA negocio TO business_api_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA negocio TO business_api_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA negocio TO business_api_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA negocio GRANT ALL ON TABLES TO business_api_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA negocio GRANT ALL ON SEQUENCES TO business_api_role;

GRANT USAGE, CREATE ON SCHEMA ml TO ml_service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA ml TO ml_service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA ml TO ml_service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA ml GRANT ALL ON TABLES TO ml_service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA ml GRANT ALL ON SEQUENCES TO ml_service_role;

GRANT USAGE ON SCHEMA negocio TO ml_service_role;
