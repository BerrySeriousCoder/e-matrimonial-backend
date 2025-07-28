CREATE TYPE "public"."font_size" AS ENUM('default', 'medium', 'large');--> statement-breakpoint
CREATE TYPE "public"."looking_for" AS ENUM('bride', 'groom');--> statement-breakpoint
CREATE TYPE "public"."status" AS ENUM('pending', 'published', 'archived', 'deleted');--> statement-breakpoint
ALTER TABLE "otps" ALTER COLUMN "otp" SET DATA TYPE varchar(6);--> statement-breakpoint
-- First, add a new timestamp column
ALTER TABLE "otps" ADD COLUMN "expires_at_new" timestamp;
-- Convert integer timestamps to timestamp (assuming they are Unix timestamps)
UPDATE "otps" SET "expires_at_new" = to_timestamp("expires_at");
-- Drop the old column and rename the new one
ALTER TABLE "otps" DROP COLUMN "expires_at";
ALTER TABLE "otps" RENAME COLUMN "expires_at_new" TO "expires_at";
ALTER TABLE "otps" ALTER COLUMN "expires_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "content" SET DATA TYPE varchar(2000);--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "user_id" integer;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "looking_for" "looking_for";--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "font_size" "font_size" DEFAULT 'default';--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "bg_color" varchar(50);--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "status" "status" DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;