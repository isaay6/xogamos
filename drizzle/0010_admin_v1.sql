CREATE TABLE "season_bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"municipality_id" uuid NOT NULL,
	"facility_id" uuid NOT NULL,
	"unit_index" integer,
	"entity_name" text NOT NULL,
	"weekday" integer NOT NULL,
	"starts_time" text NOT NULL,
	"ends_time" text NOT NULL,
	"from_date" date NOT NULL,
	"to_date" date NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "season_bookings_weekday_range" CHECK ("season_bookings"."weekday" between 0 and 6),
	CONSTRAINT "season_bookings_starts_format" CHECK ("season_bookings"."starts_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
	CONSTRAINT "season_bookings_ends_format" CHECK ("season_bookings"."ends_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
	CONSTRAINT "season_bookings_ends_after_starts" CHECK ("season_bookings"."ends_time" > "season_bookings"."starts_time"),
	CONSTRAINT "season_bookings_dates_ordered" CHECK ("season_bookings"."to_date" >= "season_bookings"."from_date"),
	CONSTRAINT "season_bookings_unit_non_negative" CHECK ("season_bookings"."unit_index" is null or "season_bookings"."unit_index" >= 0)
);
--> statement-breakpoint
ALTER TABLE "municipalities" ADD COLUMN "logo_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "season_bookings" ADD CONSTRAINT "season_bookings_municipality_id_municipalities_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_bookings" ADD CONSTRAINT "season_bookings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_bookings" ADD CONSTRAINT "season_bookings_facility_municipality_fk" FOREIGN KEY ("facility_id","municipality_id") REFERENCES "public"."facilities"("id","municipality_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "season_bookings_facility_weekday_idx" ON "season_bookings" USING btree ("facility_id","weekday");--> statement-breakpoint
CREATE INDEX "season_bookings_municipality_idx" ON "season_bookings" USING btree ("municipality_id");