-- Correr esto UNA VEZ, a mano, después de "python manage.py migrate" en
-- backend-api (es decir, después de que negocio.productos/lotes/ventas ya
-- existan). Docker no puede correrlo solo porque en el arranque del
-- contenedor esas tablas todavía no existen.
--
-- Local:    docker exec -i stockia_db psql -U postgres -d stockia -f /dev/stdin < db/manual/02_grant_lectura_ml.sql
-- Supabase: pegar y ejecutar en el SQL Editor.

GRANT SELECT ON negocio.productos, negocio.lotes, negocio.ventas TO ml_service_role;
