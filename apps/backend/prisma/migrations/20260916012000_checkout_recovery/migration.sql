-- Exact provider parameters are persisted before the external call. Existing orders remain readable.
ALTER TABLE "mock_billing_orders" ADD COLUMN "stripe_checkout_attempt" JSONB;
-- Rollback: stop checkout creation, preserve pending attempt metadata for reconciliation,
-- deploy previous application, then drop the nullable column only after outstanding payments resolve.
