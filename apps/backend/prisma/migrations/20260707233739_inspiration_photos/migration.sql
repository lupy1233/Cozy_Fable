-- CreateEnum
CREATE TYPE "inspiration_color" AS ENUM ('WHITE', 'BLACK', 'GRAY', 'BEIGE', 'BROWN', 'NATURAL_WOOD', 'GREEN', 'BLUE', 'RED', 'YELLOW', 'MULTICOLOR');

-- CreateTable
CREATE TABLE "inspiration_photos" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "room_type" "room_type" NOT NULL,
    "colors" "inspiration_color"[],
    "materials" "material"[],
    "systems" "item_system"[],
    "image_url" TEXT,
    "attachment_id" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "inspiration_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_inspiration_photos" (
    "request_id" TEXT NOT NULL,
    "photo_id" TEXT NOT NULL,

    CONSTRAINT "request_inspiration_photos_pkey" PRIMARY KEY ("request_id","photo_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inspiration_photos_attachment_id_key" ON "inspiration_photos"("attachment_id");

-- CreateIndex
CREATE INDEX "inspiration_photos_room_type_idx" ON "inspiration_photos"("room_type");

-- CreateIndex
CREATE INDEX "inspiration_photos_company_id_idx" ON "inspiration_photos"("company_id");

-- CreateIndex
CREATE INDEX "inspiration_photos_published_idx" ON "inspiration_photos"("published");

-- CreateIndex
CREATE INDEX "request_inspiration_photos_photo_id_idx" ON "request_inspiration_photos"("photo_id");

-- AddForeignKey
ALTER TABLE "inspiration_photos" ADD CONSTRAINT "inspiration_photos_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_inspiration_photos" ADD CONSTRAINT "request_inspiration_photos_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_inspiration_photos" ADD CONSTRAINT "request_inspiration_photos_photo_id_fkey" FOREIGN KEY ("photo_id") REFERENCES "inspiration_photos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
