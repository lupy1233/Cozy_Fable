-- E-admin-platform-3 (2026-09-29): inchiderea unui proiect acceptat (admin, decontare unica),
-- cazuri raportate de client / firma castigatoare, prelungire ceruta de client pe oferta
-- EXPIRED si inchiderea automata (gated prin setari) a ofertelor expirate fara decizie.
-- Strict aditiv (compatibil blue/green): valori noi de enum, tipuri noi, 2 coloane nullable,
-- un tabel nou si 4 chei system_settings. Valorile noi de enum NU sunt folosite in aceasta
-- migrare (regula Postgres pentru ALTER TYPE ... ADD VALUE; model: 20260819120000).

ALTER TYPE "request_status" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "claim_slot_status" ADD VALUE IF NOT EXISTS 'CANCELLED_PROJECT';
ALTER TYPE "claim_slot_status" ADD VALUE IF NOT EXISTS 'CANCELLED_OFFER_EXPIRED';

CREATE TYPE "project_case_reason" AS ENUM ('FIRM_UNRESPONSIVE', 'CLIENT_UNRESPONSIVE', 'MUTUAL_CANCEL_REQUEST', 'OTHER');
CREATE TYPE "project_case_opened_by" AS ENUM ('CLIENT', 'COMPANY');
CREATE TYPE "project_case_status" AS ENUM ('OPEN', 'CLOSED_PROJECT_CANCELLED', 'DISMISSED');
CREATE TYPE "project_case_response" AS ENUM ('CONFIRMED_CANCEL', 'CONTESTED');
CREATE TYPE "settlement_outcome" AS ENUM ('REFUND', 'CONSUME');

ALTER TABLE "requests" ADD COLUMN "cancelled_at" TIMESTAMPTZ;
ALTER TABLE "quote_versions" ADD COLUMN "extension_requested_at" TIMESTAMPTZ;

CREATE TABLE "request_project_cases" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "claim_slot_id" TEXT NOT NULL,
    "opened_by" "project_case_opened_by" NOT NULL,
    "opened_by_user_id" TEXT NOT NULL,
    "reason" "project_case_reason" NOT NULL,
    "note" TEXT,
    "status" "project_case_status" NOT NULL DEFAULT 'OPEN',
    "response" "project_case_response",
    "responded_by_user_id" TEXT,
    "response_note" TEXT,
    "responded_at" TIMESTAMPTZ,
    "resolved_by_user_id" TEXT,
    "resolved_at" TIMESTAMPTZ,
    "credit_outcome" "settlement_outcome",
    "admin_note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "request_project_cases_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "request_project_cases_request_id_idx" ON "request_project_cases"("request_id");
CREATE INDEX "request_project_cases_status_idx" ON "request_project_cases"("status");

-- Backstop DOAR in SQL (Prisma nu modeleaza indexuri partiale): un singur caz OPEN per cerere.
-- Cursa a doua deschideri concurente → P2002 → 409 PROJECT_CASE_ALREADY_OPEN in service.
CREATE UNIQUE INDEX "request_project_cases_one_open_per_request" ON "request_project_cases"("request_id") WHERE "status" = 'OPEN';

ALTER TABLE "request_project_cases" ADD CONSTRAINT "request_project_cases_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "request_project_cases" ADD CONSTRAINT "request_project_cases_claim_slot_id_fkey" FOREIGN KEY ("claim_slot_id") REFERENCES "claim_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Setari noi (editabile din Admin → Setari, fara deploy). Inchiderea automata e OPRITA
-- implicit; 14 zile = placeholder aliniat la pasul de valabilitate D-v6-7, folosit doar daca
-- PO activeaza; UNSET = procesorul ramane no-op pana la decizia PO (refund vs consum).
INSERT INTO "system_settings" ("key", "value", "updated_at") VALUES
    ('expired_offer_autoclose_enabled', 'false', now()),
    ('expired_offer_autoclose_days', '14', now()),
    ('expired_offer_autoclose_credit_outcome', 'UNSET', now()),
    ('delivery_reminder_days_before', '3', now())
ON CONFLICT ("key") DO NOTHING;

-- Rollback (in aceasta ordine):
-- 1. redeploy imaginea anterioara a aplicatiei (opreste workerii offer-expiry-settlement si
--    project-deadlines; joburile ramase in cozi devin no-op fara procesor);
-- 2. DELETE FROM "system_settings" WHERE "key" IN ('expired_offer_autoclose_enabled',
--    'expired_offer_autoclose_days', 'expired_offer_autoclose_credit_outcome',
--    'delivery_reminder_days_before');
--    DROP TABLE "request_project_cases";
--    DROP TYPE "project_case_reason", "project_case_opened_by", "project_case_status",
--    "project_case_response", "settlement_outcome";
--    ALTER TABLE "requests" DROP COLUMN "cancelled_at";
--    ALTER TABLE "quote_versions" DROP COLUMN "extension_requested_at";
--    (doar daca nicio cerere/slot nu foloseste valorile noi — altfel imaginea veche nu le intelege);
-- 3. valorile de enum (request_status.CANCELLED, claim_slot_status.CANCELLED_PROJECT /
--    CANCELLED_OFFER_EXPIRED) NU se pot sterge in Postgres: raman marcate "rezervat" in docs/04.
