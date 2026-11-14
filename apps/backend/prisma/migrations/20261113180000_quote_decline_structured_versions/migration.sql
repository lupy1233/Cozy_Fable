-- Etapa 4 (2026-11-13): a4 refuzul ofertei de catre client + moneda pe varianta; a3 rubrici
-- structurate pe quote_versions (TVA, termen numar + unitate, garantie in luni, transport /
-- montaj); g0-11 "ce include proiectarea"; mesaje de sistem in conversatie.
-- Strict aditiv (compatibil blue/green): tipuri noi, valori noi de enum, coloane nullable, un FK
-- nullable. Valorile noi de enum NU sunt folosite in aceasta migrare (regula Postgres pentru
-- ALTER TYPE ... ADD VALUE; model: 20260929120000). Variantele existente NU se rescriu: textele
-- delivery_term / warranty raman, rubricile noi raman NULL. Singurul backfill: moneda variantei,
-- copiata din oferta parinte (quotes.currency).
-- Rollback (codul vechi ignora coloanele): DROP coloanele noi + tipurile noi; valorile noi de enum
-- nu se pot scoate din Postgres — raman nefolosite (randurile DECLINED / OFFER_DECLINED /
-- QUOTE_DECLINED trebuie intai mutate, vezi nota de rollback din raportul etapei 4).

-- CreateEnum
CREATE TYPE "quote_vat_mode" AS ENUM ('VAT_INCLUDED', 'VAT_EXCLUDED', 'NOT_VAT_PAYER');

-- CreateEnum
CREATE TYPE "quote_delivery_term_unit" AS ENUM ('WEEKS', 'WORKING_DAYS');

-- CreateEnum
CREATE TYPE "quote_decline_reason" AS ENUM ('PRICE', 'DELIVERY_TERM', 'OTHER_COMPANY', 'GAVE_UP');

-- CreateEnum
CREATE TYPE "message_system_kind" AS ENUM ('QUOTE_CHANGE_REQUESTED', 'QUOTE_DECLINED');

-- AlterEnum
ALTER TYPE "claim_slot_status" ADD VALUE IF NOT EXISTS 'OFFER_DECLINED';

-- AlterEnum
ALTER TYPE "request_exclusion_reason" ADD VALUE IF NOT EXISTS 'QUOTE_DECLINED';

-- AlterEnum
ALTER TYPE "quote_status" ADD VALUE IF NOT EXISTS 'DECLINED';

-- AlterTable
ALTER TABLE "quotes" ADD COLUMN     "decline_note" TEXT,
ADD COLUMN     "decline_reason" "quote_decline_reason",
ADD COLUMN     "declined_at" TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "quote_versions" ADD COLUMN     "currency" "quote_currency",
ADD COLUMN     "delivery_term_unit" "quote_delivery_term_unit",
ADD COLUMN     "delivery_term_value" INTEGER,
ADD COLUMN     "design_includes" TEXT,
ADD COLUMN     "includes_assembly" BOOLEAN,
ADD COLUMN     "includes_transport" BOOLEAN,
ADD COLUMN     "vat_mode" "quote_vat_mode",
ADD COLUMN     "warranty_months" INTEGER;

-- plasa pe valorile structurate (NULL ramane permis pentru variantele vechi)
ALTER TABLE "quote_versions" ADD CONSTRAINT "quote_versions_delivery_term_value_positive" CHECK ("delivery_term_value" IS NULL OR "delivery_term_value" >= 1);
ALTER TABLE "quote_versions" ADD CONSTRAINT "quote_versions_warranty_months_positive" CHECK ("warranty_months" IS NULL OR "warranty_months" >= 1);

-- Backfill: moneda variantei = moneda ofertei parinte (singura rescriere permisa de plan)
UPDATE "quote_versions" v SET "currency" = q."currency" FROM "quotes" q WHERE q."id" = v."quote_id" AND v."currency" IS NULL;

-- AlterTable
ALTER TABLE "quote_change_requests" ADD COLUMN     "answered_by_version_id" TEXT;

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "system_kind" "message_system_kind",
ADD COLUMN     "system_payload" JSONB;

-- AddForeignKey
ALTER TABLE "quote_change_requests" ADD CONSTRAINT "quote_change_requests_answered_by_version_id_fkey" FOREIGN KEY ("answered_by_version_id") REFERENCES "quote_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
