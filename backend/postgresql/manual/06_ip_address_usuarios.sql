-- Agregar columna ip_address a la tabla usuarios para registrar la IP del último inicio de-session.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);