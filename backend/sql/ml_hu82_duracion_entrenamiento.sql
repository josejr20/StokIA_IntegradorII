-- HU-82 · BE-01 — Guardar fecha de inicio, fecha de fin y duración de cada entrenamiento.
--
-- OPCIONAL pero recomendado. Ejecutar UNA vez en el SQL Editor de Supabase (es idempotente: se puede repetir).
-- Si no se ejecuta, el backend sigue funcionando: la duración se guarda igualmente en
-- ml.modelos.metadata->'entrenamiento' y dentro del texto del mensaje de la bitácora.
-- Lo único que no se vería sin estas columnas es la duración de los intentos que fallaron por datos insuficientes
-- como dato estructurado en la tabla del historial.

ALTER TABLE ml.entrenamientos_log ADD COLUMN IF NOT EXISTS duracion_ms  integer;
ALTER TABLE ml.entrenamientos_log ADD COLUMN IF NOT EXISTS iniciado_en  timestamptz;
ALTER TABLE ml.entrenamientos_log ADD COLUMN IF NOT EXISTS finalizado_en timestamptz;

COMMENT ON COLUMN ml.entrenamientos_log.duracion_ms   IS 'HU-82: duración del entrenamiento en milisegundos';
COMMENT ON COLUMN ml.entrenamientos_log.iniciado_en   IS 'HU-82: momento en que arrancó el entrenamiento';
COMMENT ON COLUMN ml.entrenamientos_log.finalizado_en IS 'HU-82: momento en que terminó el entrenamiento';
