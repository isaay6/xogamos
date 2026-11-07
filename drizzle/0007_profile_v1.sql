ALTER TABLE "municipality_profiles" ADD COLUMN "followed" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "municipality_profiles" ADD COLUMN "residency_declared_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "onboarded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_key" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_photo" "bytea";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_mime" text;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_avatar_mime_allowed" CHECK ("users"."avatar_mime" is null or "users"."avatar_mime" in ('image/png', 'image/jpeg', 'image/webp'));