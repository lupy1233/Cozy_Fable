-- Sprint L0-D (2026-08-19): plati reale prin Stripe Checkout + dedup evenimente webhook.
-- Rollback: ALTER TABLE "mock_billing_orders" DROP COLUMN "stripe_session_id", DROP COLUMN "stripe_payment_intent_id",
--           DROP COLUMN "paid_at", DROP COLUMN "cancelled_at"; DROP TABLE "stripe_events";

-- AlterTable
ALTER TABLE "mock_billing_orders"
  ADD COLUMN "stripe_session_id" TEXT,
  ADD COLUMN "stripe_payment_intent_id" TEXT,
  ADD COLUMN "paid_at" TIMESTAMPTZ,
  ADD COLUMN "cancelled_at" TIMESTAMPTZ;

-- CreateIndex
CREATE UNIQUE INDEX "mock_billing_orders_stripe_session_id_key" ON "mock_billing_orders"("stripe_session_id");

-- CreateTable
CREATE TABLE "stripe_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "received_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stripe_events_pkey" PRIMARY KEY ("id")
);
