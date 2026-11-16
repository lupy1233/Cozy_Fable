-- b11 (plan reparatii 2026-11-13, etapa 3; PO b11-1/b11-3, g0-9): bugetul ajunge la firma ca
-- "Bugetul declarat de client" doar cand clientul a ales suma pe glisor. Formularul nou nu mai
-- pune nicio suma din oficiu si trimite budgetDeclared = true langa suma aleasa.
-- Cererile deja publicate raman false: nu se stie daca suma a fost aleasa sau pusa automat,
-- deci se arata cu eticheta neutra "Buget orientativ".
-- Strict aditiv (compatibil blue/green): o coloana NOT NULL cu DEFAULT; imaginea veche o ignora.

ALTER TABLE "requests" ADD COLUMN "budget_declared" BOOLEAN NOT NULL DEFAULT false;

-- Rollback:
-- 1. redeploy imaginea anterioara a aplicatiei (nu citeste coloana);
-- 2. ALTER TABLE "requests" DROP COLUMN "budget_declared";
