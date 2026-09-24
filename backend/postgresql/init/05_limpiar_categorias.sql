-- Categorías/familias permitidas según el Excel "catalogo_presentaciones Correcciones.xlsx"
-- (columna 'producto'): BONIFICACIONES, ESPECERIAS-AJINOMOTO, SIBARITA
-- Solo ESPECERIAS-AJINOMOTO y SIBARITA existen en la BD.
-- Se eliminan las 28 categorías que no están en el Excel.
-- Los 3 productos afectados quedarán con categoria_id = NULL (FK SET NULL).

DELETE FROM categorias WHERE nombre NOT IN ('ESPECERIAS-AJINOMOTO', 'SIBARITA');