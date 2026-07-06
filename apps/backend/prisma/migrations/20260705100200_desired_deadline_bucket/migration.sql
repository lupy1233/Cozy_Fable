-- Termen dorit ca interval (carduri), nu data exacta: clientii nu pot estima o zi fixa.
-- Backfill din vechea data relativ la published_at/created_at, apoi coloana veche pica.
-- Rollback: ADD COLUMN desired_deadline DATE (datele exacte se pierd ireversibil).

-- CreateEnum
CREATE TYPE "desired_deadline_bucket" AS ENUM ('ASAP', 'ONE_TO_THREE_MONTHS', 'THREE_TO_SIX_MONTHS', 'SIX_PLUS_MONTHS', 'FLEXIBLE');

-- AlterTable
ALTER TABLE "requests" ADD COLUMN "desired_deadline_bucket" "desired_deadline_bucket";

-- Backfill: diferenta in zile intre termenul dorit si momentul publicarii (fallback creare)
UPDATE "requests"
SET "desired_deadline_bucket" = CASE
  WHEN ("desired_deadline" - COALESCE("published_at", "created_at")::date) < 30 THEN 'ASAP'::"desired_deadline_bucket"
  WHEN ("desired_deadline" - COALESCE("published_at", "created_at")::date) < 90 THEN 'ONE_TO_THREE_MONTHS'::"desired_deadline_bucket"
  WHEN ("desired_deadline" - COALESCE("published_at", "created_at")::date) < 180 THEN 'THREE_TO_SIX_MONTHS'::"desired_deadline_bucket"
  ELSE 'SIX_PLUS_MONTHS'::"desired_deadline_bucket"
END
WHERE "desired_deadline" IS NOT NULL;

-- AlterTable
ALTER TABLE "requests" DROP COLUMN "desired_deadline";
