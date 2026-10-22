-- E-company-19 (2026-10-01): platitor TVA pe firma + perioada serviciului pe comanda. Strict aditiv (blue/green safe).
ALTER TABLE "companies" ADD COLUMN "is_vat_payer" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "mock_billing_orders" ADD COLUMN "service_period_start" TIMESTAMPTZ, ADD COLUMN "service_period_end" TIMESTAMPTZ;
-- Backfill: CUI salvat cu prefix RO (seed / date vechi) = firma declarata platitoare de TVA; cui NU se rescrie.
UPDATE "companies" SET "is_vat_payer" = true WHERE "cui" ~* '^RO';
-- Facturile deja emise NU primesc buyer_snapshot / perioada (DECIZIE NECESARA PO).
-- Rollback: 1) redeploy imaginea anterioara pe ambele sloturi (ignora coloanele noi); 2) ALTER TABLE "mock_billing_orders" DROP COLUMN "service_period_end", DROP COLUMN "service_period_start"; 3) ALTER TABLE "companies" DROP COLUMN "is_vat_payer";
