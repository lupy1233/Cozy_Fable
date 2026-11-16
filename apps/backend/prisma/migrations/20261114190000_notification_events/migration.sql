-- g1 (etapa 9, problema 45): rezumatul zilnic „cereri noi in zona ta” tine minte, pe firma,
-- momentul pana la care a trimis cererile (o cerere nu apare de doua ori in rezumat).
-- Doar adaugare, nullable: firmele existente pornesc cu NULL (= ultimele 24 h la prima rulare).
-- Rollback: ALTER TABLE "companies" DROP COLUMN "new_requests_digest_until";
ALTER TABLE "companies" ADD COLUMN "new_requests_digest_until" TIMESTAMPTZ;
