-- Limpieza de la tabla usuarios: reemplaza nombre/username por nombres, apellidos, dni
-- y elimina columnas huérfanas de funcionalidades no implementadas.

-- 1. Añadir nombres (copiando desde nombre si la columna antigua existe)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'usuarios' AND column_name = 'nombres'
    ) THEN
        ALTER TABLE public.usuarios ADD COLUMN nombres VARCHAR(100);
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'usuarios' AND column_name = 'nombre'
        ) THEN
            UPDATE public.usuarios SET nombres = nombre WHERE nombres IS NULL;
        END IF;
        ALTER TABLE public.usuarios ALTER COLUMN nombres SET NOT NULL;
    END IF;
END $$;

-- 2. Añadir apellidos
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS apellidos VARCHAR(100) DEFAULT '';
UPDATE public.usuarios SET apellidos = '' WHERE apellidos IS NULL;
ALTER TABLE public.usuarios ALTER COLUMN apellidos SET NOT NULL;

-- 3. Añadir dni (nullable, unique)
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS dni VARCHAR(20);
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_dni ON public.usuarios(dni) WHERE dni IS NOT NULL;

-- 4. Eliminar columnas huérfanas
ALTER TABLE public.usuarios DROP COLUMN IF EXISTS username;
ALTER TABLE public.usuarios DROP COLUMN IF EXISTS google_id;
ALTER TABLE public.usuarios DROP COLUMN IF EXISTS avatar;
ALTER TABLE public.usuarios DROP COLUMN IF EXISTS provider;
ALTER TABLE public.usuarios DROP COLUMN IF EXISTS email_verified;
ALTER TABLE public.usuarios DROP COLUMN IF EXISTS last_login;
ALTER TABLE public.usuarios DROP COLUMN IF EXISTS nombre;
