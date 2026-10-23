-- E-admin-platform-10: varianta A (cererea ramane claimabila dupa prima oferta cat timp sunt sloturi libere) e OPRITA pana la decizia PO (invarianta 3.1).
INSERT INTO "system_settings" ("key", "value", "updated_at") VALUES ('claims_open_after_first_offer', 'false', now()) ON CONFLICT ("key") DO NOTHING;
-- Rollback: redeploy imaginea anterioara; DELETE FROM "system_settings" WHERE "key" = 'claims_open_after_first_offer';
