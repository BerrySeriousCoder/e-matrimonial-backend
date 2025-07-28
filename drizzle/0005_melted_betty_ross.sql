CREATE TABLE "ui_texts" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" varchar(500) NOT NULL,
	"description" varchar(255),
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ui_texts_key_unique" UNIQUE("key")
);
