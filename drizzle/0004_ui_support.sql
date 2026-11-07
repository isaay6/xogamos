ALTER TABLE "facility_types" ALTER COLUMN "mascot" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."mascot";--> statement-breakpoint
CREATE TYPE "public"."mascot" AS ENUM('padel', 'tenis', 'squash', 'badminton', 'pingpong', 'futbol', 'basket', 'volei', 'balonmano', 'rugby', 'natacion', 'fronton', 'ximnasio', 'atletismo', 'escalada', 'bolos', 'ciclismo', 'patinaxe', 'golf', 'piragua', 'sala');--> statement-breakpoint
-- Conversión de las claves antiguas (LEGACY_MASCOT en src/lib/mascots.ts); una clave desconocida hace fallar el cast.
ALTER TABLE "facility_types" ALTER COLUMN "mascot" SET DATA TYPE "public"."mascot" USING (CASE "mascot" WHEN 'pala' THEN 'padel' WHEN 'gota' THEN 'natacion' WHEN 'campo' THEN 'futbol' WHEN 'muro' THEN 'fronton' WHEN 'porta' THEN 'sala' ELSE "mascot" END)::"public"."mascot";--> statement-breakpoint
ALTER TABLE "facility_types" ALTER COLUMN "mascot" SET DEFAULT 'sala';--> statement-breakpoint
ALTER TABLE "facilities" ADD COLUMN "location" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "facilities" ADD COLUMN "address" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "municipalities" ADD COLUMN "legal_notice" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "municipalities" ADD COLUMN "privacy_policy" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "municipalities" ADD COLUMN "usage_rules" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "municipalities" ADD COLUMN "logo" "bytea";--> statement-breakpoint
ALTER TABLE "municipalities" ADD COLUMN "logo_mime" text;--> statement-breakpoint
ALTER TABLE "municipalities" ADD CONSTRAINT "municipalities_logo_mime_allowed" CHECK ("municipalities"."logo_mime" is null or "municipalities"."logo_mime" in ('image/png', 'image/jpeg', 'image/webp'));