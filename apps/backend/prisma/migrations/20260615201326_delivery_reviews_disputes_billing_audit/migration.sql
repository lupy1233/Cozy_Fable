-- CreateEnum
CREATE TYPE "review_dispute_status" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "billing_order_type" AS ENUM ('SUBSCRIPTION', 'CREDIT_PACKAGE');

-- CreateEnum
CREATE TYPE "billing_order_status" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "client_user_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_disputes" (
    "id" TEXT NOT NULL,
    "review_id" TEXT NOT NULL,
    "status" "review_dispute_status" NOT NULL DEFAULT 'OPEN',
    "resolution_note" TEXT,
    "resolved_by_user_id" TEXT,
    "resolved_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_packages" (
    "id" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "price_ron" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "credit_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mock_billing_orders" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "order_type" "billing_order_type" NOT NULL,
    "status" "billing_order_status" NOT NULL DEFAULT 'PENDING',
    "plan_id" TEXT,
    "credit_package_id" TEXT,
    "credits" INTEGER,
    "base_amount_ron" DECIMAL(12,2) NOT NULL,
    "vat_rate" DECIMAL(5,2) NOT NULL,
    "vat_amount_ron" DECIMAL(12,2) NOT NULL,
    "total_ron" DECIMAL(12,2) NOT NULL,
    "invoice_series" TEXT,
    "invoice_number" INTEGER,
    "seller_snapshot" JSONB,
    "payment_source" TEXT,
    "confirmed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mock_billing_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "role" TEXT,
    "action" TEXT NOT NULL,
    "ip_hash" TEXT,
    "user_agent" TEXT,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "before" JSONB,
    "after" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reviews_request_id_key" ON "reviews"("request_id");

-- CreateIndex
CREATE INDEX "reviews_company_id_idx" ON "reviews"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "review_disputes_review_id_key" ON "review_disputes"("review_id");

-- CreateIndex
CREATE INDEX "review_disputes_status_idx" ON "review_disputes"("status");

-- CreateIndex
CREATE INDEX "mock_billing_orders_company_id_idx" ON "mock_billing_orders"("company_id");

-- CreateIndex
CREATE INDEX "mock_billing_orders_status_idx" ON "mock_billing_orders"("status");

-- CreateIndex
CREATE UNIQUE INDEX "mock_billing_orders_invoice_series_invoice_number_key" ON "mock_billing_orders"("invoice_series", "invoice_number");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_disputes" ADD CONSTRAINT "review_disputes_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mock_billing_orders" ADD CONSTRAINT "mock_billing_orders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3.9 — audit_logs append-only: trigger BEFORE UPDATE OR DELETE care arunca exceptie.
CREATE OR REPLACE FUNCTION audit_logs_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_no_update_delete
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION audit_logs_immutable();
