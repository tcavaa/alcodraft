-- The app connects as the database owner through the pooler. Supabase's
-- Data API roles must never see these tables, even if `app` is ever exposed.
REVOKE ALL ON SCHEMA "app" FROM PUBLIC;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON SCHEMA "app" FROM anon;
    REVOKE ALL ON ALL TABLES IN SCHEMA "app" FROM anon;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA "app" FROM anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA "app" REVOKE ALL ON TABLES FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON SCHEMA "app" FROM authenticated;
    REVOKE ALL ON ALL TABLES IN SCHEMA "app" FROM authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA "app" FROM authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA "app" REVOKE ALL ON TABLES FROM authenticated;
  END IF;
END $$;
