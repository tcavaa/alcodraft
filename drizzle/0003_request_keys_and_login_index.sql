CREATE TABLE "app"."request_keys" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" integer,
	"action" varchar(64) NOT NULL,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."request_keys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "app"."request_keys" ADD CONSTRAINT "request_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "request_keys_created_at_index" ON "app"."request_keys" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_log_action_created_at_index" ON "app"."audit_log" USING btree ("action","created_at");--> statement-breakpoint
-- Same lockdown as 0001 for the new table (Supabase Data API roles never see app tables).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "app"."request_keys" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON "app"."request_keys" FROM authenticated;
  END IF;
END $$;
