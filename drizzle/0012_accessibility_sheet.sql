-- SPDX-License-Identifier: EUPL-1.2
ALTER TABLE "facilities" ADD COLUMN "step_free_access" text;--> statement-breakpoint
ALTER TABLE "facilities" ADD COLUMN "adapted_toilet" boolean;--> statement-breakpoint
ALTER TABLE "facilities" ADD COLUMN "adapted_changing_room" boolean;--> statement-breakpoint
ALTER TABLE "facilities" ADD COLUMN "accessible_parking_nearby" boolean;--> statement-breakpoint
ALTER TABLE "facilities" ADD COLUMN "hearing_loop" boolean;--> statement-breakpoint
ALTER TABLE "facilities" ADD COLUMN "support_contact" varchar(120);--> statement-breakpoint
ALTER TABLE "facilities" ADD COLUMN "accessibility_notes" varchar(300);--> statement-breakpoint
ALTER TABLE "facilities" ADD COLUMN "accessibility_checked_at" date;--> statement-breakpoint
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_step_free_access_allowed" CHECK ("facilities"."step_free_access" is null or "facilities"."step_free_access" in ('yes', 'no', 'partial'));
