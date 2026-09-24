-- =========================================================
-- Base de datos: catálogo de productos (Integrador II)
-- Motor: PostgreSQL
-- Versión simplificada: un solo nivel de empaque por producto
-- =========================================================

-- ---------- Tablas maestras ----------

CREATE TABLE marca (
    id        SERIAL PRIMARY KEY,
    nombre    VARCHAR(80) NOT NULL UNIQUE,
    activo    BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE categoria (
    id     SERIAL PRIMARY KEY,
    nombre VARCHAR(80) NOT NULL UNIQUE,
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE unidad_medida (
    id      SERIAL PRIMARY KEY,
    simbolo VARCHAR(10) NOT NULL UNIQUE,
    nombre  VARCHAR(40) NOT NULL
);

CREATE TABLE tipo_envase (
    id     SERIAL PRIMARY KEY,
    nombre VARCHAR(40) NOT NULL UNIQUE
);

-- ---------- Producto (un solo nivel de empaque) ----------

CREATE TABLE producto (
    id                          SERIAL PRIMARY KEY,
    codigo                      VARCHAR(20) NOT NULL UNIQUE,
    nombre_comercial            VARCHAR(120) NOT NULL,
    contenido_valor             NUMERIC(10,2) CHECK (contenido_valor >= 0),
    unidad_id                   INT NOT NULL REFERENCES unidad_medida(id),
    marca_id                    INT REFERENCES marca(id),
    categoria_id                INT NOT NULL REFERENCES categoria(id),
    categoria_paquete_id        INT NOT NULL REFERENCES tipo_envase(id),
    contenido_paquete_cantidad  NUMERIC(10,2) CHECK (contenido_paquete_cantidad IS NULL OR contenido_paquete_cantidad > 0),
    contenido_paquete_envase_id INT REFERENCES tipo_envase(id),
    precio_venta                NUMERIC(10,2) CHECK (precio_venta IS NULL OR precio_venta >= 0),
    descripcion                 VARCHAR(255),
    es_bonificacion             BOOLEAN NOT NULL DEFAULT FALSE,
    activo                      BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en                   TIMESTAMP NOT NULL DEFAULT now(),
    -- si hay cantidad, debe haber envase, y viceversa (o ambos vacíos)
    CHECK ((contenido_paquete_cantidad IS NULL) = (contenido_paquete_envase_id IS NULL))
);

CREATE INDEX idx_producto_marca     ON producto(marca_id);
CREATE INDEX idx_producto_categoria ON producto(categoria_id);
-- Requiere la extensión pg_trgm para búsquedas ILIKE rápidas por nombre:
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CREATE INDEX idx_producto_nombre ON producto USING gin (nombre_comercial gin_trgm_ops);

-- ---------- Stock por lotes ----------

CREATE TABLE lote (
    id                SERIAL PRIMARY KEY,
    producto_id       INT NOT NULL REFERENCES producto(id),
    cantidad          NUMERIC(12,2) NOT NULL CHECK (cantidad >= 0),
    fecha_vencimiento DATE,
    fecha_ingreso     TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_lote_producto ON lote(producto_id);

-- =========================================================
-- Datos base
-- =========================================================

INSERT INTO unidad_medida (simbolo, nombre) VALUES
    ('GR', 'Gramos'), ('KG', 'Kilogramos'), ('ML', 'Mililitros'),
    ('LT', 'Litros'), ('UND', 'Unidad');

INSERT INTO tipo_envase (nombre) VALUES
    ('SOBRE'), ('SACHET'), ('BOLSA'), ('TIRA'), ('CAJA'), ('BOTELLA'),
    ('SACO'), ('DISPLAY'), ('PAQUETE'), ('BALDE'), ('BIDON'), ('PLANCHA'), ('UND');

-- Las 13 marcas reales de tu catálogo (Marca es una tabla propia:
-- agregar una nueva es un solo INSERT, sin tocar producto).
INSERT INTO marca (nombre) VALUES
    ('AJI-NO-MEN'), ('AJI-NO-MIX'), ('AJI-NO-MOTO'), ('AJI-NO-SILLAO'),
    ('ALACENA'), ('ALPESA'), ('DOÑA GUSTA'), ('EMSAL'), ('INDOMIE'),
    ('MAX SABOR'), ('NAKAMITO'), ('RICASA'), ('SIBARITA');

-- Categorías sugeridas según los productos reales que vimos en el catálogo.
-- SIBARITA por sí sola cruza varias (especias, vinagres, salsas para pasta,
-- e incluso "PLATOS ... DE LOZA CHINA", que ni siquiera es un condimento) —
-- ajústalas con tu criterio de negocio antes de migrar el resto del catálogo.
INSERT INTO categoria (nombre) VALUES
    ('Sazonadores en sobres'),
    ('Glutamato monosódico (GMS)'),
    ('Sillao y salsa de soya'),
    ('Salsas envasadas'),
    ('Vinagres'),
    ('Especias y condimentos en polvo'),
    ('Salsas para pastas'),
    ('Sal'),
    ('Fideos instantáneos'),
    ('Almidones'),
    ('Loza y vajilla');
