-- E-client-34 (Sprint 76): notite + camera pe salvarile din colectii si pe pozele de
-- inspiratie ale cererii. Aditiv (expand): coloane nullable, fara backfill; randurile vechi
-- raman NULL si codul le trateaza ca "fara notita / toata locuinta".
-- Blue/green: imaginea veche ignora coloanele. O editare de cerere facuta prin imaginea veche
-- (rollback) rescrie request_inspiration_photos fara notite/camere - pierdere acceptata.
--
-- Rollback (in ordine):
--   1. Redeploy imaginea anterioara pe ambele sloturi (nu mai citeste/scrie coloanele).
--   2. ALTER TABLE "request_inspiration_photos" DROP CONSTRAINT "request_inspiration_photos_request_room_id_fkey";
--      DROP INDEX "request_inspiration_photos_request_room_id_idx";
--      ALTER TABLE "request_inspiration_photos" DROP COLUMN "request_room_id", DROP COLUMN "note";
--   3. ALTER TABLE "inspiration_board_items" DROP COLUMN "room_type", DROP COLUMN "note";

ALTER TABLE "inspiration_board_items"
  ADD COLUMN "note" VARCHAR(200),
  ADD COLUMN "room_type" "room_type";

ALTER TABLE "request_inspiration_photos"
  ADD COLUMN "note" VARCHAR(200),
  ADD COLUMN "request_room_id" TEXT;

CREATE INDEX "request_inspiration_photos_request_room_id_idx"
  ON "request_inspiration_photos"("request_room_id");

ALTER TABLE "request_inspiration_photos"
  ADD CONSTRAINT "request_inspiration_photos_request_room_id_fkey"
  FOREIGN KEY ("request_room_id") REFERENCES "request_rooms"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
