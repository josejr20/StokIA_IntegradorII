ALTER TABLE public.importaciones_ventas
  ADD COLUMN IF NOT EXISTS hash_archivo character varying(64),
  ADD COLUMN IF NOT EXISTS detalle_errores jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS importaciones_ventas_hash_archivo_uidx
  ON public.importaciones_ventas (hash_archivo)
  WHERE hash_archivo IS NOT NULL;

COMMENT ON COLUMN public.importaciones_ventas.detalle_errores IS
  'Errores de validación por fila de la importación de ventas.';
