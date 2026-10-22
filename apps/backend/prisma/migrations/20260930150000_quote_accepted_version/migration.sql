-- E-client-1: versiunea de oferta acceptata de client. Strict aditiva, nullable, FARA backfill:
-- ofertele ACCEPTED vechi raman NULL si cititorii cad pe ultima versiune.
ALTER TABLE "quotes" ADD COLUMN "accepted_version_id" TEXT;

CREATE UNIQUE INDEX "quotes_accepted_version_id_key" ON "quotes"("accepted_version_id");

ALTER TABLE "quotes" ADD CONSTRAINT "quotes_accepted_version_id_fkey" FOREIGN KEY ("accepted_version_id") REFERENCES "quote_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Rollback (imaginea veche ignora coloana): redeploy aplicatia anterioara, apoi
-- ALTER TABLE "quotes" DROP CONSTRAINT "quotes_accepted_version_id_fkey"; DROP INDEX "quotes_accepted_version_id_key"; ALTER TABLE "quotes" DROP COLUMN "accepted_version_id";
