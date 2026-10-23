-- E-admin-platform-2 (2026-09-29): versiunea Termenilor/Politicii acceptata per user + 2 chei system_settings (identitatea operatorului). Strict aditiv (blue/green safe).
ALTER TABLE "users" ADD COLUMN "terms_version" VARCHAR(32), ADD COLUMN "privacy_version" VARCHAR(32);

INSERT INTO "system_settings" ("key", "value", "updated_at") VALUES
  ('legal_contact_email', '', now()),
  ('legal_identity_published', 'false', now())
ON CONFLICT ("key") DO NOTHING;

-- Rollback: 1) redeploy imaginea anterioara pe ambele sloturi; 2) DELETE FROM "system_settings" WHERE "key" IN ('legal_contact_email','legal_identity_published'); 3) ALTER TABLE "users" DROP COLUMN "privacy_version", DROP COLUMN "terms_version";
