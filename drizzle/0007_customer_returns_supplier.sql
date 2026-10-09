ALTER TABLE "app"."suppliers" ADD COLUMN "is_customer_returns" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- „გამოტანილები“ in every store, and the customer returns made so far move onto it.
INSERT INTO "app"."suppliers" ("store_id", "name", "is_customer_returns")
SELECT s."id", 'გამოტანილები', true FROM "app"."stores" s
WHERE NOT EXISTS (SELECT 1 FROM "app"."suppliers" x WHERE x."store_id" = s."id" AND x."is_customer_returns");--> statement-breakpoint
UPDATE "app"."stock_receipts" r SET "supplier_id" = x."id"
FROM "app"."suppliers" x
WHERE r."customer_id" IS NOT NULL AND x."store_id" = r."store_id" AND x."is_customer_returns";
