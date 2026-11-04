-- E-admin-platform-58 (expand): planurile de abonament devin date.
-- * subscription_plans.code = identitatea planului (backfill din tier pentru SILVER/GOLD/PLATINUM),
--   name_ro/name_en optionale; tier ramane coloana legacy NULLABLE (planurile noi au tier NULL).
--   DROP COLUMN tier + DROP TYPE subscription_plan_tier = release separat (contract), dupa ce
--   niciun slot blue/green nu mai ruleaza imaginea care citeste tier ca enum non-null.
-- * subscription_plan_features = functiile per plan (registrul cheilor in packages/shared
--   plan-features.ts). MARKETPLACE_ACCESS = ce verifica azi SubscriptionActiveGuard; backfill true
--   pentru planurile existente → comportament identic.
--
-- Blue/green: imaginea veche (rollback) ignora subscription_plan_features — in timpul unui rollback
-- un plan cu MARKETPLACE_ACCESS=false ar avea totusi acces la marketplace/preluari. Imaginea veche
-- nu insereaza planuri (seed-ul vechi face upsert dupa tier si ar pica pe code NOT NULL — nu se
-- ruleaza seed-ul vechi dupa aceasta migrare).
--
-- Rollback (in ordine):
--   1. Redeploy imaginea anterioara (ambele sloturi) — nu mai citeste code/features.
--   2. DROP TABLE "subscription_plan_features";
--   3. UPDATE "subscription_plans" SET "tier" = "code"::"subscription_plan_tier"
--        WHERE "tier" IS NULL AND "code" IN ('SILVER','GOLD','PLATINUM');
--      Planurile cu alte coduri se dezactiveaza/sterg INAINTE (abonamentele care le refera se
--      muta pe un plan legacy), altfel pasul urmator pica:
--      ALTER TABLE "subscription_plans" ALTER COLUMN "tier" SET NOT NULL;
--   4. DROP INDEX "subscription_plans_code_key";
--      ALTER TABLE "subscription_plans" DROP COLUMN "code", DROP COLUMN "name_ro", DROP COLUMN "name_en";

-- 1. coloane noi (nullable pentru backfill)
ALTER TABLE "subscription_plans" ADD COLUMN "code" TEXT, ADD COLUMN "name_ro" TEXT, ADD COLUMN "name_en" TEXT;

-- 2. backfill cod din tier
UPDATE "subscription_plans" SET "code" = "tier"::text WHERE "code" IS NULL;

-- 3. code obligatoriu + unic
ALTER TABLE "subscription_plans" ALTER COLUMN "code" SET NOT NULL;
CREATE UNIQUE INDEX "subscription_plans_code_key" ON "subscription_plans"("code");

-- 4. tier devine legacy nullable
ALTER TABLE "subscription_plans" ALTER COLUMN "tier" DROP NOT NULL;

-- 5. functiile planurilor
CREATE TABLE "subscription_plan_features" (
    "plan_id" TEXT NOT NULL,
    "feature_key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "limit_value" INTEGER,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "subscription_plan_features_pkey" PRIMARY KEY ("plan_id","feature_key")
);

ALTER TABLE "subscription_plan_features" ADD CONSTRAINT "subscription_plan_features_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 6. backfill: planurile existente pastreaza accesul la marketplace (comportament identic)
INSERT INTO "subscription_plan_features" ("plan_id", "feature_key", "enabled", "updated_at")
SELECT "id", 'MARKETPLACE_ACCESS', true, now() FROM "subscription_plans"
ON CONFLICT DO NOTHING;
