-- CreateEnum
CREATE TYPE "quote_currency" AS ENUM ('RON', 'EUR');

-- CreateEnum
CREATE TYPE "quote_status" AS ENUM ('DRAFT', 'SENT', 'WITHDRAWN', 'EXPIRED', 'ACCEPTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "quote_change_request_status" AS ENUM ('PENDING', 'FULFILLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "physical_consultation_invite_status" AS ENUM ('PENDING_CLIENT', 'ACCEPTED', 'DECLINED', 'COMPLETED', 'EXPIRED');

-- AlterTable
ALTER TABLE "chat_threads" ADD COLUMN "last_client_message_at" TIMESTAMPTZ;

-- CreateTable
CREATE TABLE "quotes" (
    "id" TEXT NOT NULL,
    "claim_slot_id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "currency" "quote_currency" NOT NULL DEFAULT 'RON',
    "status" "quote_status" NOT NULL DEFAULT 'DRAFT',
    "extra_versions_count" INTEGER NOT NULL DEFAULT 0,
    "withdrawn_at" TIMESTAMPTZ,
    "accepted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_versions" (
    "id" TEXT NOT NULL,
    "quote_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "is_extra" BOOLEAN NOT NULL DEFAULT false,
    "price" DECIMAL(12,2) NOT NULL,
    "design_fee" DECIMAL(12,2),
    "delivery_term" TEXT,
    "delivery_date" DATE,
    "warranty" TEXT,
    "description" TEXT,
    "valid_until" TIMESTAMPTZ NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "sent_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_change_requests" (
    "id" TEXT NOT NULL,
    "quote_version_id" TEXT NOT NULL,
    "client_user_id" TEXT NOT NULL,
    "requested_text" TEXT NOT NULL,
    "status" "quote_change_request_status" NOT NULL DEFAULT 'PENDING',
    "responded_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_validity_extensions" (
    "id" TEXT NOT NULL,
    "quote_version_id" TEXT NOT NULL,
    "extended_by_days" INTEGER NOT NULL,
    "extended_by_user_id" TEXT NOT NULL,
    "previous_valid_until" TIMESTAMPTZ NOT NULL,
    "new_valid_until" TIMESTAMPTZ NOT NULL,
    "extended_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_validity_extensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "physical_consultation_invites" (
    "id" TEXT NOT NULL,
    "quote_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "location_address" TEXT NOT NULL,
    "proposed_datetime" TIMESTAMPTZ NOT NULL,
    "alternative_datetimes" JSONB,
    "status" "physical_consultation_invite_status" NOT NULL DEFAULT 'PENDING_CLIENT',
    "client_response_text" TEXT,
    "responded_at" TIMESTAMPTZ,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "physical_consultation_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "chat_thread_id" TEXT NOT NULL,
    "sender_user_id" TEXT NOT NULL,
    "body" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quotes_claim_slot_id_idx" ON "quotes"("claim_slot_id");

-- CreateIndex
CREATE INDEX "quotes_request_id_idx" ON "quotes"("request_id");

-- CreateIndex
CREATE INDEX "quotes_company_id_idx" ON "quotes"("company_id");

-- CreateIndex
CREATE INDEX "quote_versions_quote_id_idx" ON "quote_versions"("quote_id");

-- CreateIndex
CREATE INDEX "quote_versions_valid_until_idx" ON "quote_versions"("valid_until");

-- CreateIndex
CREATE UNIQUE INDEX "quote_versions_quote_id_version_key" ON "quote_versions"("quote_id", "version");

-- CreateIndex
CREATE INDEX "quote_change_requests_quote_version_id_idx" ON "quote_change_requests"("quote_version_id");

-- CreateIndex
CREATE INDEX "quote_validity_extensions_quote_version_id_idx" ON "quote_validity_extensions"("quote_version_id");

-- CreateIndex
CREATE INDEX "physical_consultation_invites_quote_id_idx" ON "physical_consultation_invites"("quote_id");

-- CreateIndex
CREATE INDEX "physical_consultation_invites_expires_at_idx" ON "physical_consultation_invites"("expires_at");

-- CreateIndex
CREATE INDEX "messages_chat_thread_id_idx" ON "messages"("chat_thread_id");

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_claim_slot_id_fkey" FOREIGN KEY ("claim_slot_id") REFERENCES "claim_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_versions" ADD CONSTRAINT "quote_versions_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_change_requests" ADD CONSTRAINT "quote_change_requests_quote_version_id_fkey" FOREIGN KEY ("quote_version_id") REFERENCES "quote_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_validity_extensions" ADD CONSTRAINT "quote_validity_extensions_quote_version_id_fkey" FOREIGN KEY ("quote_version_id") REFERENCES "quote_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "physical_consultation_invites" ADD CONSTRAINT "physical_consultation_invites_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "physical_consultation_invites" ADD CONSTRAINT "physical_consultation_invites_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_chat_thread_id_fkey" FOREIGN KEY ("chat_thread_id") REFERENCES "chat_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
