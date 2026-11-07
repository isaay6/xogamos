-- SPDX-License-Identifier: EUPL-1.2
CREATE TYPE "public"."entity_price_mode" AS ENUM('normal', 'free', 'fixed');
--> statement-breakpoint
CREATE TABLE "entities" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
 "municipality_id" uuid NOT NULL REFERENCES "municipalities"("id") ON DELETE cascade,
 "name" text NOT NULL,
 "short_name" varchar(3) NOT NULL,
 "phone" varchar(40) DEFAULT '' NOT NULL,
 "active" boolean DEFAULT true NOT NULL,
 "price_mode" "entity_price_mode",
 "fixed_price_cents" integer,
 "advance_days" integer,
 "max_active_bookings" integer,
 "max_consecutive_slots" integer,
 "no_shows_count" boolean DEFAULT true NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 CONSTRAINT "entities_short_name_length" CHECK (char_length("short_name") between 2 and 3),
 CONSTRAINT "entities_fixed_price_non_negative" CHECK ("fixed_price_cents" is null or "fixed_price_cents" >= 0),
 CONSTRAINT "entities_advance_days_positive" CHECK ("advance_days" is null or "advance_days" >= 0),
 CONSTRAINT "entities_max_active_positive" CHECK ("max_active_bookings" is null or "max_active_bookings" >= 1),
 CONSTRAINT "entities_max_consecutive_positive" CHECK ("max_consecutive_slots" is null or "max_consecutive_slots" >= 1),
 CONSTRAINT "entities_fixed_price_required" CHECK ("price_mode" <> 'fixed' or "fixed_price_cents" is not null)
);
--> statement-breakpoint
CREATE INDEX "entities_municipality_idx" ON "entities" ("municipality_id");
--> statement-breakpoint
CREATE TABLE "entity_facilities" ("entity_id" uuid NOT NULL REFERENCES "entities"("id") ON DELETE cascade, "facility_id" uuid NOT NULL REFERENCES "facilities"("id") ON DELETE cascade, CONSTRAINT "entity_facilities_unique" UNIQUE("entity_id","facility_id"));
--> statement-breakpoint
CREATE TABLE "entity_members" ("entity_id" uuid NOT NULL REFERENCES "entities"("id") ON DELETE cascade, "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade, CONSTRAINT "entity_members_unique" UNIQUE("entity_id","user_id"));
--> statement-breakpoint
CREATE INDEX "entity_members_user_idx" ON "entity_members" ("user_id");
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "entity_id" uuid REFERENCES "entities"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "season_bookings" ADD COLUMN "entity_id" uuid REFERENCES "entities"("id") ON DELETE set null;
