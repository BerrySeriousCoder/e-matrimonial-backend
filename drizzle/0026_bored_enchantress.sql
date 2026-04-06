CREATE TABLE "classification_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "classification_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "classification_options" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"name" varchar(100) NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"for_bride" boolean DEFAULT true NOT NULL,
	"for_groom" boolean DEFAULT true NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "classification_id" integer;--> statement-breakpoint
ALTER TABLE "classification_options" ADD CONSTRAINT "classification_options_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."classification_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_classification_options_category_id" ON "classification_options" USING btree ("category_id");--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_classification_id_fkey" FOREIGN KEY ("classification_id") REFERENCES "public"."classification_options"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_posts_classification_id" ON "posts" USING btree ("classification_id");