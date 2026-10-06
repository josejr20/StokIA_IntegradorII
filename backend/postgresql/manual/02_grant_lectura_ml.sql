-- Correr UNA VEZ, a mano, después de que public.productos/lotes/ventas
-- ya existan.
--
-- Local:    psql -U postgres -d stockia -f backend/postgresql/manual/02_grant_lectura_ml.sql
-- Supabase: pegar y ejecutar en el SQL Editor.

GRANT SELECT ON public.productos, public.lotes, public.ventas TO ml_service_role;
GRANT USAGE, CREATE ON SCHEMA public TO business_api_role;
GRANT CONNECT ON DATABASE stockia TO business_api_role;
