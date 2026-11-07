CREATE TYPE "public"."social_tariff" AS ENUM('xove', 'maior', 'familia');--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'residency_verified';--> statement-breakpoint
ALTER TABLE "facilities" ADD COLUMN "price_social_cents" integer;--> statement-breakpoint
ALTER TABLE "municipality_profiles" ADD COLUMN "residency_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "municipality_profiles" ADD COLUMN "residency_verified_by" uuid;--> statement-breakpoint
ALTER TABLE "municipality_profiles" ADD COLUMN "social_tariff" "social_tariff";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "dni_hash" text;--> statement-breakpoint
ALTER TABLE "municipality_profiles" ADD CONSTRAINT "municipality_profiles_residency_verified_by_users_id_fk" FOREIGN KEY ("residency_verified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_dni_hash_unique" UNIQUE("dni_hash");--> statement-breakpoint
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_price_social_non_negative" CHECK ("facilities"."price_social_cents" is null or "facilities"."price_social_cents" >= 0);