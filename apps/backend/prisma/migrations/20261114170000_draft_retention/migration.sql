-- f6-1 (PO 2026-11-13): ciornele DRAFT neatinse (dupa updated_at) se sterg de jobul zilnic
-- draft-cleanup (03:30 ora Romaniei): ale vizitatorilor (fara cont) dupa 7 zile, ale clientilor
-- cu cont dupa 90. Valorile se schimba din Admin -> Setari (minim 1). Doar adaugari.
INSERT INTO "system_settings" ("key", "value", "updated_at") VALUES ('guest_draft_retention_days', '7', now()) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "system_settings" ("key", "value", "updated_at") VALUES ('client_draft_retention_days', '90', now()) ON CONFLICT ("key") DO NOTHING;

-- Rollback: redeploy imaginea anterioara;
-- DELETE FROM "system_settings" WHERE "key" IN ('guest_draft_retention_days', 'client_draft_retention_days');
