-- SPDX-License-Identifier: EUPL-1.2
CREATE TYPE "public"."holiday_mode" AS ENUM('closed', 'sunday_hours');--> statement-breakpoint
CREATE TABLE "holidays" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "municipality_id" uuid NOT NULL REFERENCES "municipalities"("id") ON DELETE cascade,
  "date" date NOT NULL,
  "name" text NOT NULL,
  "mode" "holiday_mode" DEFAULT 'closed' NOT NULL,
  CONSTRAINT "holidays_municipality_date_unique" UNIQUE("municipality_id", "date")
);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "text_size" text DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "high_contrast" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "reduce_motion" text DEFAULT 'system' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_text_size_allowed" CHECK ("text_size" in ('normal', 'large', 'very_large'));--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_reduce_motion_allowed" CHECK ("reduce_motion" in ('system', 'always', 'never'));--> statement-breakpoint
CREATE TABLE "facility_photos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "facility_id" uuid NOT NULL REFERENCES "facilities"("id") ON DELETE cascade,
  "position" integer NOT NULL,
  "photo" bytea NOT NULL,
  "mime" text NOT NULL,
  "alt_gl" text NOT NULL,
  "alt_es" text,
  CONSTRAINT "facility_photos_facility_position_unique" UNIQUE("facility_id", "position"),
  CONSTRAINT "facility_photos_position_range" CHECK ("position" between 0 and 2),
  CONSTRAINT "facility_photos_mime_allowed" CHECK ("mime" in ('image/png', 'image/jpeg', 'image/webp'))
);
