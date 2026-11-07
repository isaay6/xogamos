-- SPDX-License-Identifier: EUPL-1.2
CREATE TABLE "activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"municipality_id" uuid NOT NULL REFERENCES "municipalities"("id") ON DELETE CASCADE,
	"actor_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
	"kind" text NOT NULL,
	"params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "activity_logs_municipality_created_idx" ON "activity_logs" USING btree ("municipality_id","created_at");
