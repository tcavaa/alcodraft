CREATE TYPE "app"."product_category" AS ENUM('draft', 'bottle');--> statement-breakpoint
ALTER TABLE "app"."customers" ADD COLUMN "phones" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."products" ADD COLUMN "category" "app"."product_category";