DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'lotes'
      AND column_name = 'fecha_ingresso'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'lotes'
      AND column_name = 'fecha_ingreso'
  ) THEN
    ALTER TABLE public.lotes RENAME COLUMN fecha_ingresso TO fecha_ingreso;
  END IF;
END;
$$;

ALTER TABLE public.lotes
  ALTER COLUMN fecha_vencimiento DROP NOT NULL;
