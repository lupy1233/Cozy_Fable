-- Sprint 21 / E-admin-platform-14 (expand): project_size_thresholds.credit_cost e legacy
-- (PO r5: costul = creditCostFromBaseScore). Devine nullable; codul nou nu-l mai scrie.
-- DROP COLUMN = release separat (contract), dupa ce niciun slot blue/green nu mai ruleaza
-- imaginea care il citeste ca Int non-null (DECIZIE PO: r5 #3 "fara migrare distructiva").
-- Randurile existente raman neschimbate (valorile vechi 1/2/4 raman, doar constrangerea cade).
ALTER TABLE "project_size_thresholds" ALTER COLUMN "credit_cost" DROP NOT NULL;
-- Rollback: UPDATE "project_size_thresholds" SET "credit_cost" = 0 WHERE "credit_cost" IS NULL;
--           ALTER TABLE "project_size_thresholds" ALTER COLUMN "credit_cost" SET NOT NULL;
