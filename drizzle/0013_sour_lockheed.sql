ALTER TYPE "public"."status" ADD VALUE 'expired';--> statement-breakpoint
ALTER TABLE "post_search_tags" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "post_search_tags" CASCADE;--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "content" SET DATA TYPE varchar(1000);