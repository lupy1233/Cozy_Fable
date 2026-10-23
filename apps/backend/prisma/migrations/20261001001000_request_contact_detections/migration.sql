-- E-admin-platform-45 (F2-16): date de contact detectate in texte libere (log admin, fragment partial ascuns)
-- si politica pre-claim pentru texte libere (MASK implicit, DECIZIE NECESARA PO; BLOCK = publicare refuzata).

-- CreateTable
CREATE TABLE "request_contact_detections" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "trigger" VARCHAR(16) NOT NULL,
    "field" VARCHAR(16) NOT NULL,
    "room_type" "room_type",
    "step_id" VARCHAR(80),
    "kinds" TEXT[],
    "excerpt" VARCHAR(240) NOT NULL,
    "action" VARCHAR(16) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_contact_detections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "request_contact_detections_request_id_idx" ON "request_contact_detections"("request_id");

-- CreateIndex
CREATE INDEX "request_contact_detections_created_at_idx" ON "request_contact_detections"("created_at");

-- AddForeignKey
ALTER TABLE "request_contact_detections" ADD CONSTRAINT "request_contact_detections_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "system_settings" ("key", "value", "updated_at") VALUES ('pre_claim_contact_text_policy', 'MASK', now()) ON CONFLICT ("key") DO NOTHING;

-- Rollback: redeploy imaginea anterioara; apoi DELETE FROM "system_settings" WHERE "key" = 'pre_claim_contact_text_policy'; DROP TABLE "request_contact_detections";
