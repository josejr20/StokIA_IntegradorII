-- Agrega nombres de usuario para bases ya inicializadas.
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS username VARCHAR(80);

DO $$
DECLARE
    fila RECORD;
    base_username VARCHAR(80);
    username_disponible VARCHAR(80);
    sufijo INTEGER;
BEGIN
    FOR fila IN
        SELECT id, email FROM public.usuarios WHERE username IS NULL ORDER BY id
    LOOP
        base_username := left(regexp_replace(lower(split_part(fila.email, '@', 1)), '[^a-z0-9._-]+', '_', 'g'), 55);
        IF base_username = '' THEN
            base_username := 'usuario';
        END IF;

        username_disponible := base_username;
        sufijo := 1;
        WHILE EXISTS (
            SELECT 1 FROM public.usuarios WHERE username = username_disponible
        ) LOOP
            sufijo := sufijo + 1;
            username_disponible := base_username || '_' || fila.id || '_' || sufijo;
        END LOOP;

        UPDATE public.usuarios SET username = username_disponible WHERE id = fila.id;
    END LOOP;
END $$;

ALTER TABLE public.usuarios ALTER COLUMN username SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_username ON public.usuarios(username);