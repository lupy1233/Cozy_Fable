-- L0-A (auth): momentul acceptarii termenilor si conditiilor la inregistrare.
-- Conturile existente raman NULL (nu au bifat explicit in aplicatie).
-- Rollback: ALTER TABLE "users" DROP COLUMN "terms_accepted_at";

-- AlterTable
ALTER TABLE "users" ADD COLUMN "terms_accepted_at" TIMESTAMPTZ;
