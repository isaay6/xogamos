-- SPDX-License-Identifier: EUPL-1.2
ALTER TABLE "municipality_profiles" ADD COLUMN "rules_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "easy_booking" boolean DEFAULT false NOT NULL;
