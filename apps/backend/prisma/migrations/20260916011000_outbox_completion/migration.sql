ALTER TABLE "domain_event_outbox" ADD COLUMN "completed_at" TIMESTAMPTZ;
CREATE INDEX "domain_event_outbox_completed_at_dispatched_at_idx" ON "domain_event_outbox"("completed_at", "dispatched_at");
-- Rollback only after disabling recovery worker: drop this index and completed_at.
