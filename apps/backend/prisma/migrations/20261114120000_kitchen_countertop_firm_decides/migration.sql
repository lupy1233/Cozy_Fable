-- etapa 6 (formularul nou, kitchen v4): blatul bucatariei "Nu stiu - vreau recomandarea firmei".
-- Rand nou de scor, 0 puncte (PO c6-1: blatul nu schimba costul); acelasi rand in seed.ts.
-- Adminul poate doar edita randuri existente, deci il adaugam aici; o pondere deja pusa nu se suprascrie.
INSERT INTO "project_sizing_config" ("id", "key", "option", "weight") VALUES
  (gen_random_uuid()::text, 'KITCHEN_COUNTERTOP', 'FIRM_DECIDES', 0)
ON CONFLICT ("key", "option") DO NOTHING;
