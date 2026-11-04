-- E-company-21: costul unei preluari in system_settings (PO r5 V1: 1 credit = 1000 lei din bugetul minim).
-- Implicit = comportamentul actual (min 1, fara plafon). DECIZIE NECESARA PO: claim_cost_min / claim_cost_max.
-- Doar date: fara schimbare de schema/enum; slotul vechi (blue/green) ignora cheile.
INSERT INTO "system_settings" ("key", "value", "updated_at") VALUES ('credit_value_ron', '1000', now()) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "system_settings" ("key", "value", "updated_at") VALUES ('claim_cost_min', '1', now()) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "system_settings" ("key", "value", "updated_at") VALUES ('claim_cost_max', '0', now()) ON CONFLICT ("key") DO NOTHING;
-- Rollback: redeploy imaginea anterioara; apoi DELETE FROM "system_settings" WHERE "key" IN ('credit_value_ron','claim_cost_min','claim_cost_max');
