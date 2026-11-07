-- SPDX-License-Identifier: EUPL-1.2
CREATE TYPE "public"."tournament_format" AS ENUM('individual', 'parellas', 'equipos');
--> statement-breakpoint
CREATE TYPE "public"."tournament_status" AS ENUM('publicado', 'cancelado');
--> statement-breakpoint
CREATE TYPE "public"."tournament_payment" AS ENUM('monedero', 'instalacion');
--> statement-breakpoint
ALTER TYPE "notification_kind" ADD VALUE 'tournament_published';
--> statement-breakpoint
ALTER TYPE "notification_kind" ADD VALUE 'tournament_cancelled';
--> statement-breakpoint
ALTER TYPE "notification_kind" ADD VALUE 'tournament_reminder';
--> statement-breakpoint
CREATE TABLE "tournaments" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
 "municipality_id" uuid NOT NULL REFERENCES "municipalities"("id") ON DELETE cascade,
 "request_id" uuid REFERENCES "requests"("id") ON DELETE set null,
 "entity_id" uuid REFERENCES "entities"("id") ON DELETE set null,
 "facility_id" uuid NOT NULL REFERENCES "facilities"("id") ON DELETE restrict,
 "title" text NOT NULL,
 "sport_description" text NOT NULL,
 "starts_on" date NOT NULL,
 "ends_on" date NOT NULL,
 "description" text DEFAULT '' NOT NULL,
 "rules" text DEFAULT '' NOT NULL,
 "format" "tournament_format" NOT NULL,
 "team_size" integer,
 "max_entries" integer NOT NULL,
 "signup_deadline" timestamp with time zone NOT NULL,
 "fee_cents" integer DEFAULT 0 NOT NULL,
 "status" "tournament_status" DEFAULT 'publicado' NOT NULL,
 "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE restrict,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 CONSTRAINT "tournaments_dates_ordered" CHECK ("ends_on" >= "starts_on"),
 CONSTRAINT "tournaments_max_entries_positive" CHECK ("max_entries" > 0),
 CONSTRAINT "tournaments_fee_non_negative" CHECK ("fee_cents" >= 0),
 CONSTRAINT "tournaments_team_size_positive" CHECK ("team_size" is null or "team_size" > 0)
);
--> statement-breakpoint
CREATE TABLE "tournament_entries" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
 "tournament_id" uuid NOT NULL REFERENCES "tournaments"("id") ON DELETE cascade,
 "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
 "team_name" text,
 "members" text,
 "paid_with" "tournament_payment",
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "cancelled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "tournaments_municipality_starts_idx" ON "tournaments" ("municipality_id", "starts_on");
--> statement-breakpoint
CREATE INDEX "tournament_entries_tournament_idx" ON "tournament_entries" ("tournament_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_entries_active_user_unique" ON "tournament_entries" ("tournament_id", "user_id") WHERE "cancelled_at" is null;
