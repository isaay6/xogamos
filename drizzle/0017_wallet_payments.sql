CREATE TYPE "booking_payment" AS ENUM ('facility', 'wallet');--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "payment_method" "booking_payment" DEFAULT 'facility' NOT NULL;
