-- SPDX-License-Identifier: EUPL-1.2
ALTER TYPE "staff_role" ADD VALUE 'apertura';
--> statement-breakpoint
ALTER TYPE "notification_kind" ADD VALUE 'opening';
--> statement-breakpoint
ALTER TABLE "facilities" ADD COLUMN "needs_opening" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "facilities" ADD COLUMN "access_info" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "facilities" ADD COLUMN "access_info_es" text;
--> statement-breakpoint
-- Sen WHERE sobre o novo valor do enum (non se pode usar na mesma transacción): nos outros avisos
-- `openingAction` é null e o índice non restrinxe nada.
CREATE UNIQUE INDEX "notifications_opening_unique" ON "notifications" ("booking_id", "user_id", "kind", (("params"->>'openingAction')));
