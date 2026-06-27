-- CreateEnum
CREATE TYPE "withdrawal_reason_type" AS ENUM ('CLIENT_UNRESPONSIVE_48H', 'REQUEST_MODIFIED_POST_CLAIM', 'CLIENT_CONTACT_INVALID', 'CLIENT_REQUESTED_CANCELLATION', 'VOLUNTARY_NO_REASON', 'CUSTOM');

-- CreateEnum
CREATE TYPE "withdrawal_status" AS ENUM ('AUTO_APPROVED', 'PENDING_ADMIN_REVIEW', 'ADMIN_APPROVED', 'ADMIN_REJECTED');

-- CreateEnum
CREATE TYPE "penalty_scope" AS ENUM ('EMPLOYEE', 'COMPANY');

-- CreateEnum
CREATE TYPE "clarification_status" AS ENUM ('PENDING', 'ANSWERED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "claim_slot_status" ADD VALUE 'WITHDRAWN';
ALTER TYPE "claim_slot_status" ADD VALUE 'SLA_EXPIRED';

-- CreateTable
CREATE TABLE "claim_withdrawals" (
    "id" TEXT NOT NULL,
    "claim_slot_id" TEXT NOT NULL,
    "requested_by_user_id" TEXT NOT NULL,
    "reason_type" "withdrawal_reason_type" NOT NULL,
    "status" "withdrawal_status" NOT NULL,
    "custom_reason" TEXT,
    "refunded" BOOLEAN NOT NULL DEFAULT false,
    "reviewed_by_user_id" TEXT,
    "reviewed_at" TIMESTAMPTZ,
    "admin_note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "claim_withdrawals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clarification_requests" (
    "id" TEXT NOT NULL,
    "claim_slot_id" TEXT NOT NULL,
    "requested_by_user_id" TEXT NOT NULL,
    "question_text" TEXT NOT NULL,
    "answer_text" TEXT,
    "status" "clarification_status" NOT NULL DEFAULT 'PENDING',
    "answered_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clarification_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "penalty_events" (
    "id" TEXT NOT NULL,
    "scope" "penalty_scope" NOT NULL,
    "company_id" TEXT NOT NULL,
    "user_id" TEXT,
    "claim_slot_id" TEXT,
    "rule_key" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" TEXT,
    "applied_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "penalty_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "penalty_rules" (
    "id" TEXT NOT NULL,
    "rule_key" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "penalty_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_calendar_holidays" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "is_working_day" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_calendar_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "claim_withdrawals_claim_slot_id_idx" ON "claim_withdrawals"("claim_slot_id");

-- CreateIndex
CREATE INDEX "claim_withdrawals_status_idx" ON "claim_withdrawals"("status");

-- CreateIndex
CREATE INDEX "clarification_requests_claim_slot_id_idx" ON "clarification_requests"("claim_slot_id");

-- CreateIndex
CREATE INDEX "penalty_events_company_id_scope_expires_at_idx" ON "penalty_events"("company_id", "scope", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "penalty_rules_rule_key_key" ON "penalty_rules"("rule_key");

-- CreateIndex
CREATE UNIQUE INDEX "business_calendar_holidays_date_key" ON "business_calendar_holidays"("date");

-- AddForeignKey
ALTER TABLE "claim_withdrawals" ADD CONSTRAINT "claim_withdrawals_claim_slot_id_fkey" FOREIGN KEY ("claim_slot_id") REFERENCES "claim_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clarification_requests" ADD CONSTRAINT "clarification_requests_claim_slot_id_fkey" FOREIGN KEY ("claim_slot_id") REFERENCES "claim_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "penalty_events" ADD CONSTRAINT "penalty_events_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
