# P02 durable domain event contract

Scope: billing, subscription warnings, company approval lifecycle, request publication/edit/repost/deletion/expiration, chat messages, claim lifecycle, fulfillment, and quote creation/revisions/acceptance/validity/consultation expiration. The final code inventory finds domain `EventBusService.publish` calls only in the outbox dispatcher; request-controller `requests.publish` is an unrelated endpoint method.

## Persistence

- `domain_event_outbox`: UUID `id`, unique `event_key`, `event_type`, metadata-only JSON `payload`, `target_user_ids[]`, UTC `created_at`, nullable `dispatched_at`, `completed_at`, `lease_until`, integer `attempts`, sanitized `last_error`.
- `notifications`: nullable `event_id` and `email_delivered_at`; unique `(event_id, user_id)`. Old rows retain nulls and are not mailed retrospectively.
- Payloads contain entity identifiers and invoice/expiry/status metadata, never email addresses, person names, message text or credentials. Company display name and request title are resolved at delivery, not retained in the outbox. Company rejection reasons are resolved from current state only when the company remains REJECTED; a later approved company does not receive an obsolete rejection reason.
- No existing financial snapshot fields change. Pending order and payment-confirmation intents are written inside the same transaction as their domain result. No queue or socket I/O occurs inside financial transactions.

## Delivery and recovery

`domain-events` BullMQ worker sweeps every 15 seconds, conditionally leases up to 50 pending/incomplete intents for 120 seconds, dispatches only via `EventBusService.publish`, then marks enqueue progress. Incomplete events become replayable after 60 seconds: this repairs loss of queued jobs after Redis data loss. A scheduler heartbeat reinstates the repeat job after Redis loss; it does not perform domain work itself. Failed attempts remain visible in Admin jobs.

Stable job ID `event-{UUID}` prevents duplicate queue jobs while retained. Exhausted failed jobs can be retried by the outbox replay. Database `(event_id, user_id)` uniqueness prevents duplicate in-app notifications even after queue retention or Redis loss. Each email recipient is tracked separately so a later recipient's failure does not resend earlier successful recipients. Consumer completion marks the outbox complete.

Outbox with no recipients completes without a public broadcast, except for the explicitly public `request.status_changed` event. Its minimal request ID/status payload is dispatched and completed without per-recipient work. Subscription-expiry dedup key includes subscription ID, its actual expiry timestamp and threshold, preserving new warnings when a subscription is extended.

## Limits

Delivery is at least once. Socket invalidation events can repeat after a crash or expired worker lease. SMTP acceptance followed by a crash before recording the delivery marker can resend an email; SMTP does not provide an atomic transaction with PostgreSQL, so exactly-once email is not claimed. Historical lost events cannot be reconstructed from the new empty outbox. Deadline jobs remain recoverable from persisted database timestamps through lifecycle reconciliation; queue insertion failure does not roll back an already-committed domain action.

## Migration and rollback

Migrations `20260916010000_durable_billing_events` and `20260916011000_outbox_completion` are additive. Deploy database changes before the consumer application. Rollback the application/stop outbox workers before removing columns; archive pending intents first. Never drop pending delivery work as part of a routine application rollback.
