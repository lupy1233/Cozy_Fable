-- Additive: old notifications keep NULL event/email markers; no historical email replay.
CREATE TABLE "domain_event_outbox" (
  "id" TEXT NOT NULL,
  "event_key" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "target_user_ids" TEXT[] NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dispatched_at" TIMESTAMPTZ,
  "lease_until" TIMESTAMPTZ,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "last_error" TEXT,
  CONSTRAINT "domain_event_outbox_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "domain_event_outbox_event_key_key" ON "domain_event_outbox"("event_key");
CREATE INDEX "domain_event_outbox_dispatched_at_lease_until_created_at_idx" ON "domain_event_outbox"("dispatched_at", "lease_until", "created_at");
ALTER TABLE "notifications" ADD COLUMN "event_id" TEXT, ADD COLUMN "email_delivered_at" TIMESTAMPTZ;
CREATE UNIQUE INDEX "notifications_event_id_user_id_key" ON "notifications"("event_id", "user_id");
-- Rollback: first stop outbox workers and deploy the prior application, archive pending
-- intents for recovery, then drop the new notification index/columns and outbox table.
-- Do not drop a populated outbox while the durable-event application is running.
