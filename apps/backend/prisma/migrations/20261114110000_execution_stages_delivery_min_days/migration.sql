-- e1-2 (PO 2026-11-13): etape informative dupa acceptare, bifate de firma castigatoare.
-- CreateEnum
CREATE TYPE "execution_stage" AS ENUM ('MEASUREMENTS', 'CONTRACT', 'PRODUCTION', 'INSTALLATION');

-- CreateTable
CREATE TABLE "request_execution_stages" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "stage" "execution_stage" NOT NULL,
    "completed_at" TIMESTAMPTZ NOT NULL,
    "completed_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_execution_stages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "request_execution_stages_request_id_stage_key" ON "request_execution_stages"("request_id", "stage");

-- AddForeignKey
ALTER TABLE "request_execution_stages" ADD CONSTRAINT "request_execution_stages_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_execution_stages" ADD CONSTRAINT "request_execution_stages_completed_by_user_id_fkey" FOREIGN KEY ("completed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- e1-3 (PO 2026-11-13): "Marcheaza ca livrata" doar dupa 7 zile de la acceptare (0 = fara limita; se schimba din Admin).
INSERT INTO "system_settings" ("key", "value", "updated_at") VALUES ('delivery_min_days_after_accept', '7', now()) ON CONFLICT ("key") DO NOTHING;

-- Rollback: redeploy imaginea anterioara; DROP TABLE "request_execution_stages"; DROP TYPE "execution_stage";
-- DELETE FROM "system_settings" WHERE "key" = 'delivery_min_days_after_accept';
