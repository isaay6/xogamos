ALTER TABLE "notifications" ADD COLUMN "tournament_id" uuid;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Sen comparar co enum (os valores de torneo poden ser da mesma transacción): abonda tournament_id.
CREATE UNIQUE INDEX "notifications_tournament_unique" ON "notifications" USING btree ("user_id","tournament_id","kind") WHERE "notifications"."tournament_id" IS NOT NULL;
