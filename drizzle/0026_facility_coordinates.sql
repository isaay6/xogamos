ALTER TABLE "facilities" ADD COLUMN "latitude" double precision;--> statement-breakpoint
ALTER TABLE "facilities" ADD COLUMN "longitude" double precision;--> statement-breakpoint
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_latitude_range" CHECK ("latitude" is null or "latitude" between -90 and 90);--> statement-breakpoint
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_longitude_range" CHECK ("longitude" is null or "longitude" between -180 and 180);
