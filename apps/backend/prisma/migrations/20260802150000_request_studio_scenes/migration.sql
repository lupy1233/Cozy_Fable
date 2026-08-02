-- Camera 3D atasata cererii la publish (Studio 3D, feedback PO r3).
-- Rollback: DROP TABLE "request_studio_scenes";

-- CreateTable
CREATE TABLE "request_studio_scenes" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_studio_scenes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "request_studio_scenes_request_id_idx" ON "request_studio_scenes"("request_id");

-- AddForeignKey
ALTER TABLE "request_studio_scenes" ADD CONSTRAINT "request_studio_scenes_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
