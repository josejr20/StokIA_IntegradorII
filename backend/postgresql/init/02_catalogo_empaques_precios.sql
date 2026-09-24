-- ============================================================================
-- StockIA — migración: catálogo de empaques por niveles + precios con histórico
-- Basado en el análisis de catálogo de productos (analisis-catalogo-productos.md)
-- No modifica tablas existentes. Solo crea tablas y vistas nuevas.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. tipo_envase — catálogo maestro de tipos de empaque
--    (SOBRE, BOLSA, TIRA, CAJA, BOTELLA, SACO, DISPLAY, PAQUETE, BALDE, BIDON, PLANCHA, UND)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tipo_envase (
    id       SERIAL PRIMARY KEY,
    nombre  VARCHAR(40) NOT NULL UNIQUE,
    activo  BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMP NOT NULL DEFAULT now()
);

INSERT INTO public.tipo_envase (nombre) VALUES
    ('SOBRE'), ('BOLSA'), ('TIRA'), ('CAJA'), ('BOTELLA'),
    ('SACO'), ('DISPLAY'), ('PAQUETE'), ('BALDE'), ('BIDON'), ('PLANCHA'), ('UND')
ON CONFLICT (nombre) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. producto_presentacion — empaques de profundidad variable (2, 3 o 4 niveles)
--    Una fila por nivel. El total del empaque mayor se CALCULA, nunca se digita.
--    (Evita errores como el "48" que deberían ser 80 en el Excel original.)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.producto_presentacion (
    id          SERIAL PRIMARY KEY,
    producto_id INTEGER NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
    nivel       SMALLINT NOT NULL CHECK (nivel > 0),   -- 1 = empaque más pequeño, sube hacia la caja
    envase_id   INTEGER NOT NULL REFERENCES public.tipo_envase(id),
    cantidad    NUMERIC(10,2) NOT NULL CHECK (cantidad > 0),
    UNIQUE (producto_id, nivel)
);
CREATE INDEX IF NOT EXISTS idx_productopresentacion_producto ON public.producto_presentacion(producto_id);
CREATE INDEX IF NOT EXISTS idx_productopresentacion_envase ON public.producto_presentacion(envase_id);

-- Vista: calcula el total de unidades en el empaque mayor multiplicando los niveles.
-- Se usa EXP(SUM(LN(cantidad))) para multiplicar, en vez de un total tecleado.
CREATE OR REPLACE VIEW public.vista_producto_empaque_total AS
SELECT producto_id,
       ROUND(EXP(SUM(LN(cantidad)))::numeric, 0) AS total_unidades_empaque_mayor
FROM public.producto_presentacion
GROUP BY producto_id;

-- ----------------------------------------------------------------------------
-- 3. precio — historial de precios con vigencia
--    (precioLista, precioDescuento, vigente_desde)
--    Reemplaza el campo plano productos.precio_venta.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.precio (
    id               SERIAL PRIMARY KEY,
    producto_id      INTEGER NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
    precioLista     NUMERIC(10,2) NOT NULL CHECK (precioLista >= 0),
    precioDescuento NUMERIC(10,2) CHECK (precioDescuento >= 0),
    vigente_desde    DATE NOT NULL DEFAULT CURRENT_DATE,
    creado_en        TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_precio_producto ON public.precio(producto_id);

-- Vista: precio vigente por producto (el más reciente con vigente_desde <= hoy).
CREATE OR REPLACE VIEW public.vista_precios_vigentes AS
SELECT DISTINCT ON (producto_id)
    producto_id, precioLista, precioDescuento, vigente_desde
FROM public.precio
WHERE vigente_desde <= CURRENT_DATE
ORDER BY producto_id, vigente_desde DESC;

-- ----------------------------------------------------------------------------
-- 4. Adicionamos el booleano es_bonificacion a productos.
--    Reemplaza el hack de precios 0.001 y la pseudo-categoría "BONIFICACIONES".
-- ----------------------------------------------------------------------------
ALTER TABLE public.productos
    ADD COLUMN IF NOT EXISTS es_bonificacion BOOLEAN NOT NULL DEFAULT FALSE;

-- Índice para búsquedas ILIKE rápidas (requiere extensión pg_trgm).
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_productos_nombre_trgm
    ON public.productos USING gin (nombre gin_trgm_ops);