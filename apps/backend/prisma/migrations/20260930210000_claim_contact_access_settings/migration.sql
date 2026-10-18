-- E-company-3: accesul la contactele clientului pe fisa de lucru; implicit = W1 (dezvaluire la claim) si fara prag pe proiectele finalizate, pana la decizia PO (DECIZIE NECESARA).
INSERT INTO "system_settings" ("key", "value", "updated_at") VALUES ('claim_contact_reveal_policy', 'ON_CLAIM', now()) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "system_settings" ("key", "value", "updated_at") VALUES ('completed_claim_contact_retention_days', '0', now()) ON CONFLICT ("key") DO NOTHING;
-- Rollback: redeploy imaginea anterioara; apoi DELETE FROM "system_settings" WHERE "key" IN ('claim_contact_reveal_policy', 'completed_claim_contact_retention_days');
