-- AlterEnum: piese individuale de mobilier (tab separat in configurator, fara camera).
-- Izolat: ALTER TYPE ADD VALUE nu poate fi folosit in aceeasi tranzactie (PG16).
-- Rollback: valorile enum nu se pot sterge in PG; ar necesita recreare tip.
ALTER TYPE "room_type" ADD VALUE 'PIECES';
