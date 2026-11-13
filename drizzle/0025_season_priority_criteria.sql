ALTER TABLE "municipalities" ADD COLUMN "season_priority_criteria" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "passes" ADD COLUMN "cancelled_at" timestamp with time zone;
