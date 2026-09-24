-- ============================================================================
-- 06 — Campos de empaque del producto (NuevoProductoModal)
-- Ajusta la tabla productos para soportar: contenido neto, categoría de
-- paquete y envase del contenido del paquete, siguiendo la referencia en
-- Ejemplo.sql.
-- ============================================================================

-- Contenido neto del producto (ej. 80 para "AJI-NO-MEN CARNE 80 GR")
ALTER TABLE productos
    ADD COLUMN IF NOT EXISTS contenido_valor NUMERIC(10,2)
    CHECK (contenido_valor >= 0);

-- Categoría de paquete (UNIDAD, CAJA, SOBRE…) — referencia a tipo_envase
ALTER TABLE productos
    ADD COLUMN IF NOT EXISTS categoria_paquete_id INTEGER
    REFERENCES tipo_envase(id);

-- Cantidad de unidades dentro del paquete (ej. 24 para "X24 SOBRES")
ALTER TABLE productos
    ADD COLUMN IF NOT EXISTS contenido_paquete_cantidad NUMERIC(10,2)
    CHECK (contenido_paquete_cantidad IS NULL OR contenido_paquete_cantidad > 0);

-- Envase del contenido del paquete (SOBRES, TIRAS, BOLSA…) — referencia a tipo_envase
ALTER TABLE productos
    ADD COLUMN IF NOT EXISTS contenido_paquete_envase_id INTEGER
    REFERENCES tipo_envase(id);

-- Regla de negocio: cantidad y envase van juntos (ambos o ninguno)
ALTER TABLE productos
    DROP CONSTRAINT IF EXISTS chk_producto_paquete_emparejado;

ALTER TABLE productos
    ADD CONSTRAINT chk_producto_paquete_emparejado
    CHECK ((contenido_paquete_cantidad IS NULL) = (contenido_paquete_envase_id IS NULL));

-- Índices para búsquedas y filtros
CREATE INDEX IF NOT EXISTS idx_productos_categoria_paquete
    ON productos(categoria_paquete_id);
CREATE INDEX IF NOT EXISTS idx_productos_contenido_envase
    ON productos(contenido_paquete_envase_id);
