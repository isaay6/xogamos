CREATE TYPE "public"."waitlist_status" AS ENUM('waiting', 'offered', 'booked', 'expired', 'withdrawn');--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE IF NOT EXISTS 'waitlist_offer';--> statement-breakpoint
CREATE TABLE "waitlist_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"municipality_id" uuid NOT NULL,
	"facility_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "waitlist_status" DEFAULT 'waiting' NOT NULL,
	"offered_until" timestamp with time zone
);--> statement-breakpoint
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_facility_municipality_fk" FOREIGN KEY ("facility_id","municipality_id") REFERENCES "public"."facilities"("id","municipality_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist_entries" ADD CONSTRAINT "waitlist_entries_profile_municipality_fk" FOREIGN KEY ("profile_id","municipality_id") REFERENCES "public"."municipality_profiles"("id","municipality_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "waitlist_entries_slot_idx" ON "waitlist_entries" USING btree ("facility_id","starts_at","created_at");--> statement-breakpoint
CREATE INDEX "waitlist_entries_profile_idx" ON "waitlist_entries" USING btree ("profile_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "waitlist_entries_active_unique" ON "waitlist_entries" USING btree ("profile_id","facility_id","starts_at") WHERE "waitlist_entries"."status" IN ('waiting', 'offered');
