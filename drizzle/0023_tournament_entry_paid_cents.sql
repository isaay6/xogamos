-- SPDX-License-Identifier: EUPL-1.2
ALTER TABLE "tournament_entries" ADD COLUMN "paid_cents" integer DEFAULT 0 NOT NULL;
