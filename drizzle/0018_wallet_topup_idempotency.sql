ALTER TABLE "wallet_movements" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "wallet_movements" ADD CONSTRAINT "wallet_movements_idempotency_key_unique" UNIQUE("idempotency_key");
