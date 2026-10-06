DO $$
DECLARE
  schema_name TEXT;
  constraint_name TEXT;
  table_name TEXT;
BEGIN
  FOREACH schema_name IN ARRAY ARRAY['public', 'public'] LOOP
    table_name := format('%I.movimientos_inventario', schema_name);
    IF to_regclass(table_name) IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = schema_name
          AND table_name = 'movimientos_inventario'
          AND column_name = 'costo_unitario_manual'
      ) THEN
        EXECUTE format(
          'ALTER TABLE %s ADD COLUMN costo_unitario_manual BOOLEAN NOT NULL DEFAULT FALSE',
          table_name
        );
        EXECUTE format(
          'UPDATE %s SET costo_unitario_manual = TRUE WHERE tipo = ''ingreso'' AND precio_unitario IS NOT NULL',
          table_name
        );
      END IF;

      FOR constraint_name IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = to_regclass(table_name)
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%origen%'
      LOOP
        EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', table_name, constraint_name);
      END LOOP;
      EXECUTE format(
        'ALTER TABLE %s ADD CONSTRAINT movimientos_inventario_origen_check CHECK (origen IN (''compra'', ''venta'', ''inicial'', ''ajuste'', ''devolucion'', ''anulacion'', ''otro''))',
        table_name
      );
    END IF;

    table_name := format('%I.ventas', schema_name);
    IF to_regclass(table_name) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %s ADD COLUMN IF NOT EXISTS operacion_id BIGINT', table_name);
      FOR constraint_name IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = to_regclass(table_name)
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%origen%'
      LOOP
        EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', table_name, constraint_name);
      END LOOP;
      EXECUTE format(
        'ALTER TABLE %s ADD CONSTRAINT ventas_origen_check CHECK (origen IN (''manual'', ''importado'', ''devolucion'', ''anulacion''))',
        table_name
      );
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON %s (operacion_id)',
        schema_name || '_ventas_operacion_id_idx',
        table_name
      );
    END IF;
  END LOOP;
END;
$$;
