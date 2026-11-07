-- SPDX-License-Identifier: EUPL-1.2
CREATE TABLE "pass_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"municipality_id" uuid NOT NULL,
	"facility_type_id" uuid NOT NULL,
	"name" text NOT NULL,
	"days" integer NOT NULL,
	"price_cents" integer NOT NULL,
	CONSTRAINT "pass_types_days_positive" CHECK ("pass_types"."days" >= 1),
	CONSTRAINT "pass_types_price_non_negative" CHECK ("pass_types"."price_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "passes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pass_type_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"pin" varchar(4) NOT NULL,
	"price_cents" integer NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "passes_dates_ordered" CHECK ("passes"."ends_on" >= "passes"."starts_on"),
	CONSTRAINT "passes_pin_format" CHECK ("passes"."pin" ~ '^[0-9]{4}$'),
	CONSTRAINT "passes_price_non_negative" CHECK ("passes"."price_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "pass_types" ADD CONSTRAINT "pass_types_municipality_id_municipalities_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pass_types" ADD CONSTRAINT "pass_types_facility_type_municipality_fk" FOREIGN KEY ("facility_type_id","municipality_id") REFERENCES "public"."facility_types"("id","municipality_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passes" ADD CONSTRAINT "passes_pass_type_id_pass_types_id_fk" FOREIGN KEY ("pass_type_id") REFERENCES "public"."pass_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passes" ADD CONSTRAINT "passes_profile_id_municipality_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."municipality_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passes" ADD CONSTRAINT "passes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pass_types_municipality_idx" ON "pass_types" USING btree ("municipality_id");--> statement-breakpoint
CREATE INDEX "passes_profile_idx" ON "passes" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "passes_pin_dates_idx" ON "passes" USING btree ("pin","starts_on","ends_on");
