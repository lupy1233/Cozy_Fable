-- Preferinte de contact: canal restrans la EMAIL/PHONE (validat ca format),
-- campul priority dispare (UX nou fara prioritati).
-- Mapare date existente: canal liber care contine "mail" → EMAIL, restul → PHONE.
-- Rollback: ALTER COLUMN channel TYPE TEXT + ADD COLUMN priority INT (valorile initiale se pierd).

-- CreateEnum
CREATE TYPE "contact_channel" AS ENUM ('EMAIL', 'PHONE');

-- Normalizare valori existente inainte de conversia tipului
UPDATE "request_contact_preferences"
SET "channel" = CASE WHEN "channel" ILIKE '%mail%' THEN 'EMAIL' ELSE 'PHONE' END;

-- AlterTable: conversie text → enum
ALTER TABLE "request_contact_preferences"
  ALTER COLUMN "channel" TYPE "contact_channel" USING "channel"::"contact_channel";

-- AlterTable
ALTER TABLE "request_contact_preferences" DROP COLUMN "priority";
