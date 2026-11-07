-- SPDX-License-Identifier: EUPL-1.2
-- Quen xa existía antes da benvida (v1) non a ve á forza: dáse por feita.
UPDATE "users" SET "onboarded_at" = now() WHERE "onboarded_at" IS NULL;
