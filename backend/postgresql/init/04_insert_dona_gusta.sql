-- Insertar la marca faltante DOÑA GUSTA (el Excel la tiene pero Python/PowerShell la leen mal)
INSERT INTO catalogo_marcas (nombre) VALUES ('DOÑA GUSTA') ON CONFLICT DO NOTHING;