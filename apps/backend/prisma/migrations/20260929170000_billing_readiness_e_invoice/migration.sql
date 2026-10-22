-- E-admin-platform-4 (2026-09-29): stare e-Factura per comanda + cumparator inghetat + comenzi test. Strict aditiv (blue/green safe).

-- CreateEnum
CREATE TYPE "e_invoice_status" AS ENUM ('PENDING', 'UPLOADED', 'VALIDATED', 'REJECTED', 'NOT_REQUIRED');

-- AlterTable
ALTER TABLE "mock_billing_orders" ADD COLUMN     "anaf_download_id" VARCHAR(32),
ADD COLUMN     "anaf_upload_id" VARCHAR(32),
ADD COLUMN     "buyer_snapshot" JSONB,
ADD COLUMN     "e_invoice_status" "e_invoice_status",
ADD COLUMN     "e_invoice_updated_at" TIMESTAMPTZ,
ADD COLUMN     "test_mode" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: facturile deja emise nu au fost raportate — apar ca "De raportat", nu sunt sarite.
UPDATE "mock_billing_orders" SET "e_invoice_status" = 'PENDING' WHERE "status" = 'CONFIRMED' AND "invoice_number" IS NOT NULL AND "e_invoice_status" IS NULL;

-- CreateIndex
CREATE INDEX "mock_billing_orders_e_invoice_status_idx" ON "mock_billing_orders"("e_invoice_status");

-- Rollback: 1) redeploy imaginea anterioara pe ambele sloturi (ignora coloanele noi); 2) DROP INDEX "mock_billing_orders_e_invoice_status_idx"; 3) ALTER TABLE "mock_billing_orders" DROP COLUMN "e_invoice_updated_at", DROP COLUMN "anaf_download_id", DROP COLUMN "anaf_upload_id", DROP COLUMN "e_invoice_status", DROP COLUMN "buyer_snapshot", DROP COLUMN "test_mode"; 4) DROP TYPE "e_invoice_status";
