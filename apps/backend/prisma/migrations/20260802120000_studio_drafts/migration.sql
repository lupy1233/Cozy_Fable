-- Studio 3D (mod Sims, cerinta PO 2026-08-02): drafturile salvate in cont.
-- Rollback: DROP TABLE "studio_drafts";

-- CreateTable
CREATE TABLE "studio_drafts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "studio_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "studio_drafts_user_id_idx" ON "studio_drafts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "studio_drafts_user_id_name_key" ON "studio_drafts"("user_id", "name");

-- AddForeignKey
ALTER TABLE "studio_drafts" ADD CONSTRAINT "studio_drafts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
