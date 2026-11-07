CREATE TYPE "wallet_movement_kind" AS ENUM ('recarga_tarxeta', 'recarga_mobil', 'pago_reserva', 'pago_abono', 'devolucion', 'axuste');--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE cascade,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "wallet_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_id" uuid NOT NULL REFERENCES "wallets"("id") ON DELETE restrict,
	"amount_cents" integer NOT NULL,
	"kind" "wallet_movement_kind" NOT NULL,
	"municipality_id" uuid REFERENCES "municipalities"("id") ON DELETE set null,
	"reference" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "wallet_movements_wallet_created_idx" ON "wallet_movements" ("wallet_id", "created_at");--> statement-breakpoint
CREATE TABLE "recharge_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"municipality_id" uuid NOT NULL REFERENCES "municipalities"("id") ON DELETE cascade,
	"code_hash" varchar(64) NOT NULL UNIQUE,
	"amount_cents" integer NOT NULL,
	"issued_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE restrict,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"used_by_wallet_id" uuid REFERENCES "wallets"("id") ON DELETE restrict,
	"used_at" timestamp with time zone,
	CONSTRAINT "recharge_cards_amount_allowed" CHECK ("amount_cents" in (1000, 2000, 5000)),
	CONSTRAINT "recharge_cards_used_together" CHECK (("used_by_wallet_id" is null) = ("used_at" is null))
);--> statement-breakpoint
CREATE INDEX "recharge_cards_municipality_issued_idx" ON "recharge_cards" ("municipality_id", "issued_at");
