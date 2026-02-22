CREATE TABLE "email_unsubscribes" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"unsubscribed_at" timestamp DEFAULT now() NOT NULL,
	"reason" varchar(255),
	CONSTRAINT "email_unsubscribes_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX "idx_email_unsubscribes_email" ON "email_unsubscribes" USING btree ("email" text_ops);