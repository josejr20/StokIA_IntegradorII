-- US-32 · Notificar alertas críticas por correo electrónico (HU-164, HU-165, HU-166)
--
-- Ejecutar UNA vez en el SQL Editor de Supabase. Es idempotente: se puede repetir sin efectos.
-- Requiere que ya existan las tablas `roles`, `alertas` y `notificaciones_correo`.

-- ---------------------------------------------------------------------------
-- HU-165 · BE-02 — Destinatarios por rol
-- Un rol puede recibir las alertas críticas de un tipo (vencimiento y/o stock).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notificacion_destinatarios_rol (
  id                  serial PRIMARY KEY,
  rol_id              integer     NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  tipo_alerta         varchar(30) NOT NULL,
  activo              boolean     NOT NULL DEFAULT true,
  fecha_actualizacion timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notificacion_destinatarios_rol_tipo_ck
    CHECK (tipo_alerta IN ('riesgo_vencimiento', 'bajo_stock')),
  CONSTRAINT notificacion_destinatarios_rol_uq UNIQUE (rol_id, tipo_alerta)
);

COMMENT ON TABLE notificacion_destinatarios_rol IS
  'US-32: roles que reciben por correo las alertas críticas de cada tipo';

-- Configuración inicial: encargados de almacén e inventario reciben ambos tipos.
-- Solo se inserta si el rol existe; ON CONFLICT evita duplicar o pisar cambios posteriores.
INSERT INTO notificacion_destinatarios_rol (rol_id, tipo_alerta, activo)
SELECT r.id, t.tipo, true
FROM roles r
CROSS JOIN (VALUES ('riesgo_vencimiento'), ('bajo_stock')) AS t(tipo)
WHERE r.nombre IN ('Encargado de Almacén', 'Encargado de Inventario')
ON CONFLICT (rol_id, tipo_alerta) DO NOTHING;

-- ---------------------------------------------------------------------------
-- HU-166 · BE-03 — Historial y reintentos
-- Se amplía `notificaciones_correo` (no se cambian sus columnas ni estados actuales).
-- ---------------------------------------------------------------------------
ALTER TABLE notificaciones_correo ADD COLUMN IF NOT EXISTS rol               varchar(50);
ALTER TABLE notificaciones_correo ADD COLUMN IF NOT EXISTS asunto            varchar(300);
ALTER TABLE notificaciones_correo ADD COLUMN IF NOT EXISTS intentos          integer NOT NULL DEFAULT 0;
ALTER TABLE notificaciones_correo ADD COLUMN IF NOT EXISTS ultimo_error      text;
ALTER TABLE notificaciones_correo ADD COLUMN IF NOT EXISTS proximo_reintento timestamptz;
ALTER TABLE notificaciones_correo ADD COLUMN IF NOT EXISTS fecha_creacion    timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN notificaciones_correo.intentos          IS 'US-32: envíos intentados (incluye el primero)';
COMMENT ON COLUMN notificaciones_correo.ultimo_error      IS 'US-32: mensaje del último fallo de envío';
COMMENT ON COLUMN notificaciones_correo.proximo_reintento IS 'US-32: cuándo se reintenta; NULL = sin reintentos pendientes';

-- Búsqueda de envíos pendientes de reintento y consulta de historial.
CREATE INDEX IF NOT EXISTS notificaciones_correo_reintento_idx
  ON notificaciones_correo (proximo_reintento)
  WHERE proximo_reintento IS NOT NULL;
CREATE INDEX IF NOT EXISTS notificaciones_correo_alerta_idx
  ON notificaciones_correo (alerta_id, destinatario);
CREATE INDEX IF NOT EXISTS notificaciones_correo_fecha_idx
  ON notificaciones_correo (fecha_creacion DESC);
