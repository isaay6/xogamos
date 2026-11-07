ALTER TABLE "facilities" DROP CONSTRAINT "facilities_type_id_facility_types_id_fk";--> statement-breakpoint
ALTER TABLE "facility_types" ADD CONSTRAINT "facility_types_id_municipality_unique" UNIQUE("id","municipality_id");--> statement-breakpoint
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_type_municipality_fk" FOREIGN KEY ("type_id","municipality_id") REFERENCES "public"."facility_types"("id","municipality_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_municipality_idx" ON "bookings" USING btree ("municipality_id");--> statement-breakpoint
CREATE INDEX "bookings_profile_municipality_idx" ON "bookings" USING btree ("profile_id","municipality_id");--> statement-breakpoint
ALTER TABLE "closures" ADD CONSTRAINT "closures_ends_after_starts" CHECK ("closures"."ends_at" > "closures"."starts_at");--> statement-breakpoint
ALTER TABLE "opening_hours" ADD CONSTRAINT "opening_hours_opens_format" CHECK ("opening_hours"."opens" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');--> statement-breakpoint
ALTER TABLE "opening_hours" ADD CONSTRAINT "opening_hours_closes_format" CHECK ("opening_hours"."closes" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');--> statement-breakpoint
ALTER TABLE "opening_hours" ADD CONSTRAINT "opening_hours_closes_after_opens" CHECK ("opening_hours"."closes" > "opening_hours"."opens");
