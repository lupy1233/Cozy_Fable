-- AlterTable: stare bruta wizard configurator pe cerere (backup draft; null dupa publish)
ALTER TABLE "requests" ADD COLUMN     "configurator_state" JSONB;

-- AlterTable: raspunsuri brute chestionar + versiunea flow-ului, per camera.
-- Nullable: cererile legacy (seed/demo) raman valide, randate cu fallback pe items.
ALTER TABLE "request_rooms" ADD COLUMN     "answers" JSONB,
ADD COLUMN     "flow_version" INTEGER;
