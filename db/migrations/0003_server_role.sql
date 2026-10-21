-- Server-only Data API permissions for CarbonPulse.
--
-- The Supabase project is intentionally created with automatic table exposure
-- disabled. The application uses the secret key only inside server modules, so
-- service_role needs explicit access while anon/authenticated receive no new
-- grants from this migration.

grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Keep future server-side tables usable without enabling automatic browser
-- exposure for anon or authenticated roles.
alter default privileges for role postgres in schema public
  grant all privileges on tables to service_role;
alter default privileges for role postgres in schema public
  grant usage, select on sequences to service_role;
