CREATE TABLE "otps" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"otp" varchar(10) NOT NULL,
	"expires_at" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
