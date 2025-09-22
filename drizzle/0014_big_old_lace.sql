CREATE TYPE "public"."admin_role" AS ENUM('superadmin', 'admin', 'data_entry');--> statement-breakpoint
ALTER TYPE "public"."status" ADD VALUE 'edited';--> statement-breakpoint
ALTER TYPE "public"."status" ADD VALUE 'payment_pending';--> statement-breakpoint
CREATE TABLE "coupon_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(50) NOT NULL,
	"discount_percentage" numeric(5, 2) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"usage_limit" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coupon_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "payment_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"base_price_first_200" integer DEFAULT 5000 NOT NULL,
	"additional_price_per_20_chars" integer DEFAULT 500 NOT NULL,
	"large_font_multiplier" numeric(3, 2) DEFAULT '1.20' NOT NULL,
	"visibility_2_weeks_multiplier" numeric(3, 2) DEFAULT '1.00' NOT NULL,
	"visibility_3_weeks_multiplier" numeric(3, 2) DEFAULT '1.50' NOT NULL,
	"visibility_4_weeks_multiplier" numeric(3, 2) DEFAULT '2.00' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer,
	"razorpay_payment_link_id" varchar(255),
	"razorpay_payment_id" varchar(255),
	"razorpay_payment_link_reference_id" varchar(255),
	"amount" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"coupon_code" varchar(50),
	"discount_amount" integer DEFAULT 0 NOT NULL,
	"final_amount" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "font_size" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "font_size" SET DEFAULT 'default'::text;--> statement-breakpoint
DROP TYPE "public"."font_size";--> statement-breakpoint
CREATE TYPE "public"."font_size" AS ENUM('default', 'large');--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "font_size" SET DEFAULT 'default'::"public"."font_size";--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "font_size" SET DATA TYPE "public"."font_size" USING "font_size"::"public"."font_size";--> statement-breakpoint
ALTER TABLE "admins" ADD COLUMN "role" "admin_role" DEFAULT 'admin' NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "created_by_admin_id" integer;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "payment_transaction_id" integer;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "base_amount" integer;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "final_amount" integer;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "coupon_code" varchar(50);--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_coupon_code_coupon_codes_code_fk" FOREIGN KEY ("coupon_code") REFERENCES "public"."coupon_codes"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_created_by_admin_id_admins_id_fk" FOREIGN KEY ("created_by_admin_id") REFERENCES "public"."admins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_payment_transaction_id_payment_transactions_id_fk" FOREIGN KEY ("payment_transaction_id") REFERENCES "public"."payment_transactions"("id") ON DELETE no action ON UPDATE no action;