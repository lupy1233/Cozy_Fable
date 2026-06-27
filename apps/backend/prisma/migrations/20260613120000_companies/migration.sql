-- CreateEnum
CREATE TYPE "company_status" AS ENUM ('PENDING_VERIFICATION', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "company_member_role" AS ENUM ('OWNER', 'MANAGER', 'EMPLOYEE_TRUSTED', 'EMPLOYEE_MANAGED');

-- CreateEnum
CREATE TYPE "offer_field_key" AS ENUM ('PRICE', 'DELIVERY_TERM', 'DELIVERY_DATE', 'WARRANTY', 'DESCRIPTION');

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cui" TEXT NOT NULL,
    "reg_com_number" TEXT NOT NULL,
    "status" "company_status" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "address_text" TEXT NOT NULL,
    "county" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "rejected_at" TIMESTAMPTZ,
    "rejection_reason" TEXT,
    "suspended_at" TIMESTAMPTZ,
    "suspended_until" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_members" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "company_member_role" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_locations" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "address_text" TEXT NOT NULL,
    "county" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "coverage_radius_km" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_verification_profiles" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "risk_flags" TEXT[],
    "reviewed_by_user_id" TEXT,
    "reviewed_at" TIMESTAMPTZ,
    "decision_note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "company_verification_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_portfolio_items" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_portfolio_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_offer_field_permissions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "role" "company_member_role" NOT NULL,
    "field_key" "offer_field_key" NOT NULL,
    "can_edit" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "company_offer_field_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "companies_cui_idx" ON "companies"("cui");

-- CreateIndex
CREATE INDEX "companies_status_idx" ON "companies"("status");

-- CreateIndex
CREATE UNIQUE INDEX "company_members_user_id_key" ON "company_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "company_members_company_id_user_id_key" ON "company_members"("company_id", "user_id");

-- CreateIndex
CREATE INDEX "company_members_company_id_idx" ON "company_members"("company_id");

-- CreateIndex
CREATE INDEX "company_locations_company_id_idx" ON "company_locations"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "company_verification_profiles_company_id_key" ON "company_verification_profiles"("company_id");

-- CreateIndex
CREATE INDEX "company_portfolio_items_company_id_idx" ON "company_portfolio_items"("company_id");

-- CreateIndex
CREATE INDEX "company_offer_field_permissions_company_id_idx" ON "company_offer_field_permissions"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "company_offer_field_permissions_company_id_role_field_key_key" ON "company_offer_field_permissions"("company_id", "role", "field_key");

-- AddForeignKey
ALTER TABLE "company_members" ADD CONSTRAINT "company_members_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_members" ADD CONSTRAINT "company_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_locations" ADD CONSTRAINT "company_locations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_verification_profiles" ADD CONSTRAINT "company_verification_profiles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_portfolio_items" ADD CONSTRAINT "company_portfolio_items_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_offer_field_permissions" ADD CONSTRAINT "company_offer_field_permissions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
