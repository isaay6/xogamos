-- SPDX-License-Identifier: EUPL-1.2
CREATE TYPE "public"."request_kind" AS ENUM('tempada', 'evento', 'outro');
--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('pendente', 'mais_datos', 'aprobada', 'rexeitada', 'retirada');
--> statement-breakpoint
CREATE TYPE "public"."closure_kind" AS ENUM('peche', 'evento');
--> statement-breakpoint
ALTER TYPE "notification_kind" ADD VALUE 'request_status';
--> statement-breakpoint
ALTER TABLE "closures" ADD COLUMN "kind" "closure_kind" DEFAULT 'peche' NOT NULL;
--> statement-breakpoint
ALTER TABLE "closures" ADD COLUMN "title" text;
--> statement-breakpoint
ALTER TABLE "closures" ADD COLUMN "request_id" uuid;
--> statement-breakpoint
CREATE TABLE "requests" (
 "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
 "municipality_id" uuid NOT NULL REFERENCES "municipalities"("id") ON DELETE cascade,
 "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
 "entity_id" uuid REFERENCES "entities"("id") ON DELETE set null,
 "kind" "request_kind" NOT NULL,
 "facility_id" uuid REFERENCES "facilities"("id") ON DELETE set null,
 "unit_index" integer,
 "from_date" date NOT NULL,
 "to_date" date NOT NULL,
 "weekdays" integer[],
 "starts_time" text NOT NULL,
 "ends_time" text NOT NULL,
 "title" text NOT NULL,
 "description" text DEFAULT '' NOT NULL,
 "people" integer,
 "phone" text DEFAULT '' NOT NULL,
 "status" "request_status" DEFAULT 'pendente' NOT NULL,
 "response" text,
 "decided_by" uuid REFERENCES "users"("id") ON DELETE set null,
 "decided_at" timestamp with time zone,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
 CONSTRAINT "requests_dates_ordered" CHECK ("to_date" >= "from_date"),
 CONSTRAINT "requests_starts_format" CHECK ("starts_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
 CONSTRAINT "requests_ends_format" CHECK ("ends_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
 CONSTRAINT "requests_ends_after_starts" CHECK ("ends_time" > "starts_time"),
 CONSTRAINT "requests_weekdays_tempada" CHECK ("kind" <> 'tempada' or cardinality("weekdays") > 0),
 CONSTRAINT "requests_people_positive" CHECK ("people" is null or "people" > 0)
);
--> statement-breakpoint
ALTER TABLE "closures" ADD CONSTRAINT "closures_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE set null;
--> statement-breakpoint
CREATE INDEX "requests_municipality_status_idx" ON "requests" ("municipality_id", "status");
--> statement-breakpoint
CREATE INDEX "requests_user_municipality_idx" ON "requests" ("user_id", "municipality_id");
