CREATE TABLE "post_search_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"option_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_filter_options" (
	"id" serial PRIMARY KEY NOT NULL,
	"section_id" integer NOT NULL,
	"value" varchar(100) NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_filter_sections" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"description" varchar(255),
	"order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "search_filter_sections_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "post_emails" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "post_emails" ADD COLUMN "email" varchar(255);--> statement-breakpoint
ALTER TABLE "post_search_tags" ADD CONSTRAINT "post_search_tags_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_search_tags" ADD CONSTRAINT "post_search_tags_option_id_search_filter_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."search_filter_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_filter_options" ADD CONSTRAINT "search_filter_options_section_id_search_filter_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."search_filter_sections"("id") ON DELETE cascade ON UPDATE no action;