-- CreateEnum
CREATE TYPE "request_status" AS ENUM ('DRAFT', 'IN_MARKETPLACE', 'CLAIMED_PARTIAL', 'CLAIMED_FULL', 'OFFERS_RECEIVED', 'NEGOTIATION', 'ACCEPTED', 'IN_EXECUTION', 'DELIVERED_BY_COMPANY', 'COMPLETED', 'DISPUTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "budget_range" AS ENUM ('UNDER_5K', 'FROM_5K_TO_15K', 'OVER_15K');

-- CreateEnum
CREATE TYPE "room_type" AS ENUM ('KITCHEN', 'DRESSING', 'LIVING', 'OFFICE', 'BEDROOM', 'BATHROOM');

-- CreateEnum
CREATE TYPE "material" AS ENUM ('PAL', 'MDF', 'LEMN_MASIV');

-- CreateEnum
CREATE TYPE "item_system" AS ENUM ('PUSH', 'GLISANTE', 'BUTON_PRESIUNE');

-- CreateEnum
CREATE TYPE "attachment_status" AS ENUM ('PENDING_UPLOAD', 'PENDING_SCAN', 'SAFE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "project_size" AS ENUM ('SMALL', 'MEDIUM', 'LARGE');

-- CreateTable
CREATE TABLE "requests" (
    "id" TEXT NOT NULL,
    "client_user_id" TEXT,
    "draft_token_hash" TEXT,
    "status" "request_status" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT,
    "description" TEXT,
    "budget_range" "budget_range",
    "desired_deadline" DATE,
    "includes_paid_design" BOOLEAN NOT NULL DEFAULT false,
    "has_own_project" BOOLEAN NOT NULL DEFAULT false,
    "address_text" TEXT,
    "county" TEXT,
    "city" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "size_score" INTEGER,
    "project_size" "project_size",
    "credit_cost" INTEGER,
    "pre_claim_edits_used" INTEGER NOT NULL DEFAULT 0,
    "post_claim_edits_used" INTEGER NOT NULL DEFAULT 0,
    "repost_used" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMPTZ,
    "expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_versions" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_rooms" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "room_type" "room_type" NOT NULL,
    "length_m" DOUBLE PRECISION NOT NULL,
    "width_m" DOUBLE PRECISION NOT NULL,
    "height_m" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_items" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "material" "material" NOT NULL,
    "systems" "item_system"[],
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "request_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_contact_preferences" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,

    CONSTRAINT "request_contact_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "status" "attachment_status" NOT NULL DEFAULT 'PENDING_UPLOAD',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_sizing_config" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "option" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,

    CONSTRAINT "project_sizing_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_size_thresholds" (
    "id" TEXT NOT NULL,
    "size" "project_size" NOT NULL,
    "min_score" INTEGER NOT NULL,
    "max_score" INTEGER,
    "credit_cost" INTEGER NOT NULL,

    CONSTRAINT "project_size_thresholds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geocoding_cache" (
    "id" TEXT NOT NULL,
    "query_key" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "display_name" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "geocoding_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "requests_draft_token_hash_key" ON "requests"("draft_token_hash");

-- CreateIndex
CREATE INDEX "requests_client_user_id_idx" ON "requests"("client_user_id");

-- CreateIndex
CREATE INDEX "requests_status_idx" ON "requests"("status");

-- CreateIndex
CREATE INDEX "request_versions_request_id_idx" ON "request_versions"("request_id");

-- CreateIndex
CREATE UNIQUE INDEX "request_versions_request_id_version_key" ON "request_versions"("request_id", "version");

-- CreateIndex
CREATE INDEX "request_rooms_request_id_idx" ON "request_rooms"("request_id");

-- CreateIndex
CREATE INDEX "request_items_room_id_idx" ON "request_items"("room_id");

-- CreateIndex
CREATE INDEX "request_contact_preferences_request_id_idx" ON "request_contact_preferences"("request_id");

-- CreateIndex
CREATE INDEX "attachments_entity_type_entity_id_idx" ON "attachments"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_sizing_config_key_option_key" ON "project_sizing_config"("key", "option");

-- CreateIndex
CREATE UNIQUE INDEX "project_size_thresholds_size_key" ON "project_size_thresholds"("size");

-- CreateIndex
CREATE UNIQUE INDEX "geocoding_cache_query_key_key" ON "geocoding_cache"("query_key");

-- AddForeignKey
ALTER TABLE "request_versions" ADD CONSTRAINT "request_versions_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_rooms" ADD CONSTRAINT "request_rooms_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_items" ADD CONSTRAINT "request_items_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "request_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_contact_preferences" ADD CONSTRAINT "request_contact_preferences_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
