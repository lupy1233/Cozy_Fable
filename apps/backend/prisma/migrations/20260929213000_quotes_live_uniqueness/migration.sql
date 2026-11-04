-- E-company-2: plasa DB impotriva cursei createQuote vs inchidere/accept si a dublei cereri de modificare.
-- Pre-verificare pe prod (trebuie 0 randuri, altfel indexul unic nu se construieste):
--   SELECT claim_slot_id, count(*) FROM quotes WHERE status IN ('SENT','EXPIRED') GROUP BY 1 HAVING count(*) > 1;
--   SELECT quote_version_id, count(*) FROM quote_change_requests WHERE status = 'PENDING' GROUP BY 1 HAVING count(*) > 1;
-- Indexurile traiesc DOAR in SQL (Prisma nu modeleaza indexuri partiale): nu le pierde la un
-- migrate diff / db push din schema.prisma.
CREATE UNIQUE INDEX IF NOT EXISTS "quotes_one_live_per_claim_slot" ON "quotes" ("claim_slot_id") WHERE "status" IN ('SENT', 'EXPIRED');
CREATE UNIQUE INDEX IF NOT EXISTS "quote_change_requests_one_pending_per_version" ON "quote_change_requests" ("quote_version_id") WHERE "status" = 'PENDING';
-- Rollback (aditiv, compatibil cu slotul vechi): DROP INDEX IF EXISTS "quote_change_requests_one_pending_per_version"; DROP INDEX IF EXISTS "quotes_one_live_per_claim_slot";
