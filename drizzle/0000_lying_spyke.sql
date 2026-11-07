CREATE TYPE "public"."booking_channel" AS ENUM('online', 'phone', 'desk');--> statement-breakpoint
CREATE TYPE "public"."booking_mode" AS ENUM('slot', 'unit', 'capacity', 'day');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('confirmed', 'cancelled', 'no_show', 'attended');--> statement-breakpoint
CREATE TYPE "public"."identity_provider" AS ENUM('clave', 'chave365', 'local');--> statement-breakpoint
CREATE TYPE "public"."mascot" AS ENUM('pala', 'gota', 'campo', 'muro', 'porta');--> statement-breakpoint
CREATE TYPE "public"."staff_role" AS ENUM('admin', 'conserxe', 'deputacion');--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"municipality_id" uuid NOT NULL,
	"facility_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"unit_index" integer,
	"seats" integer DEFAULT 1 NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" "booking_status" DEFAULT 'confirmed' NOT NULL,
	"access_code" char(6) NOT NULL,
	"price_cents" integer NOT NULL,
	"channel" "booking_channel" NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "closures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"reason" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"municipality_id" uuid NOT NULL,
	"type_id" uuid NOT NULL,
	"name" text NOT NULL,
	"units" integer DEFAULT 1 NOT NULL,
	"capacity" integer DEFAULT 1 NOT NULL,
	"slot_minutes" integer DEFAULT 60 NOT NULL,
	"price_resident_cents" integer NOT NULL,
	"price_non_resident_cents" integer NOT NULL,
	"accessible" boolean DEFAULT false NOT NULL,
	"rules" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facility_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"municipality_id" uuid NOT NULL,
	"name_gl" text NOT NULL,
	"name_es" text NOT NULL,
	"mascot" "mascot" NOT NULL,
	"color" text NOT NULL,
	"booking_mode" "booking_mode" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "municipalities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"province" text NOT NULL,
	"primary_color" text NOT NULL,
	"cancellation_deadline_minutes" integer DEFAULT 120 NOT NULL,
	"max_days_ahead" integer DEFAULT 14 NOT NULL,
	"no_show_threshold" integer DEFAULT 3 NOT NULL,
	"penalty_days" integer DEFAULT 7 NOT NULL,
	CONSTRAINT "municipalities_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "municipality_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"municipality_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"is_resident" boolean DEFAULT false NOT NULL,
	"no_show_count" integer DEFAULT 0 NOT NULL,
	"penalty_until" timestamp with time zone,
	CONSTRAINT "profiles_municipality_user_unique" UNIQUE("municipality_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "opening_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facility_id" uuid NOT NULL,
	"weekday" integer NOT NULL,
	"opens" text NOT NULL,
	"closes" text NOT NULL,
	CONSTRAINT "opening_hours_weekday_range" CHECK ("opening_hours"."weekday" between 0 and 6)
);
--> statement-breakpoint
CREATE TABLE "staff_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"municipality_id" uuid,
	"role" "staff_role" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" "identity_provider" NOT NULL,
	"subject" text NOT NULL,
	"display_name" text NOT NULL,
	"email" text,
	CONSTRAINT "users_provider_subject_unique" UNIQUE("provider","subject")
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_municipality_id_municipalities_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_profile_id_municipality_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."municipality_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closures" ADD CONSTRAINT "closures_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_municipality_id_municipalities_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_type_id_facility_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."facility_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facility_types" ADD CONSTRAINT "facility_types_municipality_id_municipalities_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "municipality_profiles" ADD CONSTRAINT "municipality_profiles_municipality_id_municipalities_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "municipality_profiles" ADD CONSTRAINT "municipality_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opening_hours" ADD CONSTRAINT "opening_hours_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_roles" ADD CONSTRAINT "staff_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_roles" ADD CONSTRAINT "staff_roles_municipality_id_municipalities_id_fk" FOREIGN KEY ("municipality_id") REFERENCES "public"."municipalities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_facility_starts_idx" ON "bookings" USING btree ("facility_id","starts_at");