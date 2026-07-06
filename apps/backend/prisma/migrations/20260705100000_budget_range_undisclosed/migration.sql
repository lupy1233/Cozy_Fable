-- AlterEnum: optiunea "nu doresc sa impartasesc bugetul" (slider buget).
-- Izolat: ALTER TYPE ADD VALUE nu poate fi folosit in aceeasi tranzactie (PG16).
-- Rollback: valorile enum nu se pot sterge in PG; ar necesita recreare tip.
ALTER TYPE "budget_range" ADD VALUE 'UNDISCLOSED';
