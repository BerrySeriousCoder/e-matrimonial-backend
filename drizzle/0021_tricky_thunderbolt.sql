CREATE TABLE "search_synonym_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "search_synonym_groups_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "search_synonym_words" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer NOT NULL,
	"word" varchar(100) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "search_synonym_words_word_unique" UNIQUE("word")
);
--> statement-breakpoint
ALTER TABLE "search_synonym_words" ADD CONSTRAINT "search_synonym_words_group_id_search_synonym_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."search_synonym_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_search_synonym_words_word" ON "search_synonym_words" USING btree ("word" text_ops);