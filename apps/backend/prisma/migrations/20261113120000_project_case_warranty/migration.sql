-- e2 (plan reparatii 2026-11-13, etapa 1): reclamatia clientului dupa finalizare (in garantie)
-- ca tip nou de caz de proiect + momentul finalizarii cererii (de aici curge fereastra de garantie).
-- Strict aditiv (compatibil blue/green): o valoare noua de enum, o coloana nullable.
-- Valoarea noua de enum NU e folosita in aceasta migrare (regula Postgres pentru ALTER TYPE ... ADD VALUE).

ALTER TYPE "project_case_reason" ADD VALUE IF NOT EXISTS 'WARRANTY_CLAIM';

ALTER TABLE "requests" ADD COLUMN "completed_at" TIMESTAMPTZ;

-- Fara backfill: cererile finalizate inainte raman cu completed_at NULL; serviciul cade pe
-- delivered_at (apoi updated_at) cand calculeaza fereastra de garantie.

-- Rollback:
-- 1. redeploy imaginea anterioara a aplicatiei;
-- 2. ALTER TABLE "requests" DROP COLUMN "completed_at";
-- 3. valoarea project_case_reason.WARRANTY_CLAIM NU se poate sterge in Postgres: ramane
--    marcata "rezervat" in docs/04 (cazurile existente cu acest motiv raman citibile doar de imaginea noua).
