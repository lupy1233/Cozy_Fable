-- CreateEnum
CREATE TYPE "subscription_plan_tier" AS ENUM ('SILVER', 'GOLD', 'PLATINUM');

-- CreateEnum
CREATE TYPE "subscription_status" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "credit_transaction_type" AS ENUM ('GRANT', 'RESERVE', 'REFUND', 'CONSUME');

-- CreateEnum
CREATE TYPE "claim_slot_status" AS ENUM ('ACTIVE', 'OFFER_SENT', 'CANCELLED_UNASSIGNED', 'CANCELLED_BY_CLIENT', 'WITHDRAWN_VOLUNTARY', 'COMPLETED');

-- CreateEnum
CREATE TYPE "request_exclusion_reason" AS ENUM ('SLA_BREACH');

-- CreateTable
CREATE TABLE "subscription_plans" (
    "id" TEXT NOT NULL,
    "tier" "subscription_plan_tier" NOT NULL,
    "price_ron" INTEGER NOT NULL,
    "included_credits" INTEGER NOT NULL,
    "marketplace_gating_delay_minutes" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "status" "subscription_status" NOT NULL DEFAULT 'ACTIVE',
    "is_trial" BOOLEAN NOT NULL DEFAULT false,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "trial_ends_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_credit_wallets" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "company_credit_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_transactions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "type" "credit_transaction_type" NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "claim_slot_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claim_slots" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "claimed_by_user_id" TEXT NOT NULL,
    "assigned_to_user_id" TEXT,
    "status" "claim_slot_status" NOT NULL DEFAULT 'ACTIVE',
    "quote_id" TEXT,
    "sla_deadline_at" TIMESTAMPTZ,
    "sla_paused_at" TIMESTAMPTZ,
    "project_size_snapshot" "project_size" NOT NULL,
    "project_score_snapshot" INTEGER NOT NULL,
    "claim_cost_credits_snapshot" INTEGER NOT NULL,
    "assign_deadline_at" TIMESTAMPTZ,
    "withdrawn_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "claim_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_threads" (
    "id" TEXT NOT NULL,
    "claim_slot_id" TEXT NOT NULL,
    "negotiation_ended_by_company" BOOLEAN NOT NULL DEFAULT false,
    "read_only" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_company_exclusions" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "reason" "request_exclusion_reason" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_company_exclusions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "response_status" INTEGER NOT NULL,
    "response_body" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plans_tier_key" ON "subscription_plans"("tier");

-- CreateIndex
CREATE INDEX "subscriptions_company_id_status_idx" ON "subscriptions"("company_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "company_credit_wallets_company_id_key" ON "company_credit_wallets"("company_id");

-- CreateIndex
CREATE INDEX "credit_transactions_company_id_idx" ON "credit_transactions"("company_id");

-- CreateIndex
CREATE INDEX "credit_transactions_claim_slot_id_idx" ON "credit_transactions"("claim_slot_id");

-- CreateIndex
CREATE INDEX "claim_slots_request_id_status_idx" ON "claim_slots"("request_id", "status");

-- CreateIndex
CREATE INDEX "claim_slots_company_id_idx" ON "claim_slots"("company_id");

-- CreateIndex
CREATE INDEX "claim_slots_assigned_to_user_id_idx" ON "claim_slots"("assigned_to_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "chat_threads_claim_slot_id_key" ON "chat_threads"("claim_slot_id");

-- CreateIndex
CREATE INDEX "request_company_exclusions_request_id_idx" ON "request_company_exclusions"("request_id");

-- CreateIndex
CREATE UNIQUE INDEX "request_company_exclusions_request_id_company_id_key" ON "request_company_exclusions"("request_id", "company_id");

-- CreateIndex
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_key_endpoint_key" ON "idempotency_keys"("key", "endpoint");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_credit_wallets" ADD CONSTRAINT "company_credit_wallets_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_slots" ADD CONSTRAINT "claim_slots_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_slots" ADD CONSTRAINT "claim_slots_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_slots" ADD CONSTRAINT "claim_slots_claimed_by_user_id_fkey" FOREIGN KEY ("claimed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claim_slots" ADD CONSTRAINT "claim_slots_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_claim_slot_id_fkey" FOREIGN KEY ("claim_slot_id") REFERENCES "claim_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_company_exclusions" ADD CONSTRAINT "request_company_exclusions_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_company_exclusions" ADD CONSTRAINT "request_company_exclusions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- docs 4.9 — regula "1 claim activ fara oferta" pe assigned_to_user_id.
-- Partial unique index (Prisma nu il poate exprima nativ).
CREATE UNIQUE INDEX "claim_slots_one_active_unoffered_per_assignee"
  ON "claim_slots" ("assigned_to_user_id")
  WHERE "status" = 'ACTIVE' AND "quote_id" IS NULL AND "assigned_to_user_id" IS NOT NULL;

-- docs 4.8 — o firma da un singur claim ne-anulat per cerere.
CREATE UNIQUE INDEX "claim_slots_one_active_per_company_per_request"
  ON "claim_slots" ("request_id", "company_id")
  WHERE "status" IN ('ACTIVE', 'OFFER_SENT', 'COMPLETED');
