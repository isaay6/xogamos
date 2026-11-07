ALTER TABLE "bookings" DROP CONSTRAINT "bookings_facility_id_facilities_id_fk";--> statement-breakpoint
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_profile_id_municipality_profiles_id_fk";--> statement-breakpoint
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_id_municipality_unique" UNIQUE("id","municipality_id");--> statement-breakpoint
ALTER TABLE "municipality_profiles" ADD CONSTRAINT "profiles_id_municipality_unique" UNIQUE("id","municipality_id");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_facility_municipality_fk" FOREIGN KEY ("facility_id","municipality_id") REFERENCES "public"."facilities"("id","municipality_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_profile_municipality_fk" FOREIGN KEY ("profile_id","municipality_id") REFERENCES "public"."municipality_profiles"("id","municipality_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_ends_after_starts" CHECK ("bookings"."ends_at" > "bookings"."starts_at");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_seats_positive" CHECK ("bookings"."seats" >= 1);--> statement-breakpoint
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_slot_minutes_positive" CHECK ("facilities"."slot_minutes" > 0);--> statement-breakpoint
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_units_positive" CHECK ("facilities"."units" >= 1);--> statement-breakpoint
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_capacity_positive" CHECK ("facilities"."capacity" >= 1);--> statement-breakpoint
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_price_resident_non_negative" CHECK ("facilities"."price_resident_cents" >= 0);--> statement-breakpoint
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_price_non_resident_non_negative" CHECK ("facilities"."price_non_resident_cents" >= 0);
