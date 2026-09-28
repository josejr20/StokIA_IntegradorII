-- Limpieza de la tabla usuarios: reemplaza nombre/username por nombres, apellidos, dni
-- y elimina columnas huérfanas de funcionalidades no implementadas.

-- 1. Añadir nombres (copiando desde nombre si la columna antigua existe)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'negocio' AND table_name = 'usuarios' AND column_name = 'nombres'
    ) THEN
        ALTER TABLE negocio.usuarios ADD COLUMN nombres VARCHAR(100);
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'negocio' AND table_name = 'usuarios' AND column_name = 'nombre'
        ) THEN
            UPDATE negocio.usuarios SET nombres = nombre WHERE nombres IS NULL;
        END IF;
        ALTER TABLE negocio.usuarios ALTER COLUMN nombres SET NOT NULL;
    END IF;
END $$;

-- 2. Añadir apellidos
ALTER TABLE negocio.usuarios ADD COLUMN IF NOT EXISTS apellidos VARCHAR(100) DEFAULT '';
UPDATE negocio.usuarios SET apellidos = '' WHERE apellidos IS NULL;
ALTER TABLE negocio.usuarios ALTER COLUMN apellidos SET NOT NULL;

-- 3. Añadir dni (nullable, unique)
ALTER TABLE negocio.usuarios ADD COLUMN IF NOT EXISTS dni VARCHAR(20);
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_dni ON negocio.usuarios(dni) WHERE dni IS NOT NULL;

-- 4. Eliminar columnas huérfanas
ALTER TABLE negocio.usuarios DROP COLUMN IF EXISTS username;
ALTER TABLE negocio.usuarios DROP COLUMN IF EXISTS google_id;
ALTER TABLE negocio.usuarios DROP COLUMN IF EXISTS avatar;
ALTER TABLE negocio.usuarios DROP COLUMN IF EXISTS provider;
ALTER TABLE negocio.usuarios DROP COLUMN IF EXISTS email_verified;
ALTER TABLE negocio.usuarios DROP COLUMN IF EXISTS last_login;
ALTER TABLE negocio.usuarios DROP COLUMN IF EXISTS nombre;
