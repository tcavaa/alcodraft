ALTER TYPE "app"."delivery_kind" ADD VALUE 'count';--> statement-breakpoint
ALTER TYPE "app"."delivery_kind" ADD VALUE 'return';--> statement-breakpoint
ALTER TABLE "app"."stock_receipts" ADD COLUMN "customer_id" integer;--> statement-breakpoint
ALTER TABLE "app"."stock_receipts" ADD COLUMN "delivery_id" integer;--> statement-breakpoint
ALTER TABLE "app"."stock_receipts" ADD CONSTRAINT "stock_receipts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "app"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."stock_receipts" ADD CONSTRAINT "stock_receipts_delivery_id_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "app"."deliveries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stock_receipts_delivery_id_index" ON "app"."stock_receipts" USING btree ("delivery_id");