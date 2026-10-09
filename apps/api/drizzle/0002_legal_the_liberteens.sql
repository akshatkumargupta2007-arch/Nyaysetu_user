ALTER TABLE "citizens" ALTER COLUMN "device_token_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "citizens" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "citizens" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "citizens" ADD CONSTRAINT "citizens_username_unique" UNIQUE("username");