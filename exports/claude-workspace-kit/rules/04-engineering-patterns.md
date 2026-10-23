# Engineering patterns (invariants to adopt)

This chapter lists the technical invariants Claude treats as non-negotiable when writing backend, worker and frontend code. It covers concurrency and locking, idempotency, payments, state machines, time and business calendars, time-based jobs, events and the outbox, file storage, money, data integrity and soft delete, audit, the error contract, versioned formats, shared validation, configuration, and frontend state boundaries.
The rules assume a TypeScript monorepo: NestJS, Prisma, PostgreSQL, Redis/BullMQ and S3-compatible storage on the backend, and Next.js, TanStack Query and Zustand on the frontend. On another stack, keep each rule's intent and map the mechanism (Prisma error code → your driver's equivalent, middleware → your ORM hook). Copy the rules that apply into `<INVARIANTS_DOC>`, fill in the `<PLACEHOLDERS>`, and record every deliberate deviation in `<DECISIONS_LOG>`.

## Transactions and concurrency

- **ENG-001** `MUST` Run every operation that consumes or changes a limited shared capacity (slots, stock, seats) in a SERIALIZABLE transaction with an explicit timeout (e.g. 10 s). The transaction first locks the parent row with `SELECT ... FOR UPDATE` (via `$queryRaw`). Under the lock it checks, in order: the parent's status is in the allowed set and the parent is not soft-deleted; the active children are under the cap; the actor is eligible (balance, exclusions, per-actor limits). Only then does it insert the child with its ledger and side records and update the parent's aggregate status. — _why:_ prevents two concurrent actors from both taking the last unit of capacity.
- **ENG-002** `MUST` Every path that changes the number of active children under a capacity-limited parent uses that same parent-row lock. This includes release, cancel, withdraw and reassign, and also background jobs that touch the capacity. Copy the existing reference implementation instead of reinventing it.
- **ENG-003** `MUST` Keep business logic in services. Open every interactive transaction through one helper (e.g. `runTx(prisma, profile, fn)`) whose named profiles fix isolation, `maxWait`, timeout and serialization retry. Example profiles (maxWait 5 s): read = REPEATABLE READ, 20 s; write = READ COMMITTED (Postgres default), 20 s; critical = SERIALIZABLE with retry, 20 s; capacity = SERIALIZABLE with retry and the fixed timeout set in `<INVARIANTS_DOC>` (e.g. 10 s), which is never raised to absorb latency. Ban direct `$transaction` calls with an ESLint `no-restricted-syntax` rule that exempts only the helper, specs and seed scripts. — _why:_ isolation and timeout policy lives in one place, and every new transaction has to pick a profile on purpose.
- **ENG-004** `MUST` Retry serialization failures up to 3 times with a random 20–80 ms pause. These are Prisma `P2034`, plus `P2010` with SQLSTATE `40001`/`40P01`, which is how they arrive from `$queryRaw ... FOR UPDATE`. If the last attempt also fails, return 409 with a retryable concurrent-modification code, never 500. — _why:_ the jitter keeps colliding transactions from retrying in lockstep, and the client gets a conflict it can retry.
- **ENG-005** `MUST` A callback on a retrying profile can run several times. It therefore has no effects outside `tx`: no queue adds, HTTP calls, emails or socket emits, and no changes to outer variables. Schedule those effects after commit. Financial transactions in particular contain no queue or socket I/O.
- **ENG-006** `SHOULD` The global exception filter maps transient DB errors to 503 with a retryable "database busy" code and `Retry-After: 2`, logged as a warning. These are `P2028` (interactive transaction timed out or failed to start), `P2024` (pool timeout), `P1001` (unreachable) and `P1017` (connection closed). The action was not saved and the idempotency key stays open. A `P2002` unique violation that escapes a service maps to a specific retryable 409 whose log names only the constraint, never the values. The backend retries neither case itself.
- **ENG-007** `MUST` When there is no parent row to lock (e.g. a cap of N children per owner), serialize inside the transaction with `pg_advisory_xact_lock(hashtextextended('<type>:<id>', 0))` before counting and inserting, so two simultaneous inserts cannot exceed the cap. Serialize all mutations of a per-user resource family (e.g. session tokens) by first locking the owning user row `FOR UPDATE`.
- **ENG-008** `MUST` Enforce "at most one open X per parent" twice: re-check it under the parent row lock, and back it with a partial unique index in SQL whose violation (`P2002`) maps to a dedicated 409.
- **ENG-009** `MUST` When a user confirms an action based on what the UI showed (a document version, a computed outcome, a terms version), the client sends that expected value. The server compares it before the transaction and again under the lock. On a mismatch it returns 409 with only the current IDs in `details` and writes nothing. A mismatch caused by an old client bundle still open during a rollout gets the stale-client handling of OPS-049.
- **ENG-010** `MUST` Run validation, policy and rate-limit checks before any external call (payment provider, geocoder) and before opening the transaction, so a refusal has no side effects. Document "nothing is written" for each such refusal.
- **ENG-011** `MUST` When a transaction must persist a defensive write and then fail (e.g. revoking a compromised token family), return a sentinel from the callback and throw after the commit. — _why:_ throwing inside the callback rolls the defensive write back.
- **ENG-012** `SHOULD` Keep interactive transactions short: count their queries, prefer app-generated IDs with `createMany` over per-row queries, and set an explicit timeout on large ones. Treat batching and longer timeouts as stopgaps for latency-bound paths; region placement is covered by OPS-088. — _why:_ at cross-region latencies a few dozen sequential round trips reach Prisma's default 5 s interactive-transaction ceiling, which surfaces as `P2028`.
- **ENG-013** `SHOULD` Prefer the simplest mechanism that is adequate at the current scale, such as a row lock over advisory or optimistic locking below ~100 RPS, or two nullable columns over a separate assignment entity. Record the reason in `<DECISIONS_LOG>`. — _why:_ extra machinery adds complexity and debugging cost without value at MVP scale.

## Idempotency

- **ENG-014** `MUST` For every mutation that moves money or closes a state, choose the idempotency mechanism on purpose, usually a header key combined with a conditional transition. Keep the five mechanisms distinct: Idempotency-Key receipts, conditional status transitions, provider-side dedup, outbox event keys and deterministic job IDs.
- **ENG-015** `MUST` Mark critical POSTs with an `@Idempotent()` decorator whose interceptor requires an `Idempotency-Key` header holding a UUID v4 generated by the frontend. Critical POSTs are capacity consumption, accept/commit actions, money-bearing creates, irreversible actions, payment webhooks and purchases. — _why:_ double submit is the most common source of financial bugs, and this is the standard Stripe/AWS pattern.
- **ENG-016** `MUST` A receipt is identified by the key, the HTTP method and the concrete path including path params, and it stores a sha256 of the canonicalized `{ body, query, userId }`. Persist key, user ID, endpoint, request hash, response body, response status and `expires_at` in a dedicated idempotency table, with 24 h dedup:
  - The same key with the same hash replays the original HTTP status and body.
  - The same key with a different hash or user returns 409.
  - Definitive 4xx responses are cached too, so a retry with the same key replays the same 4xx. After re-reading state, the client sends the corrected body under a new key. A 5xx or unknown outcome is never stored as a final result (see ENG-017).
- **ENG-017** `MUST` Make key ownership atomic and transactional. Reserve the receipt before execution, lock it `FOR UPDATE` as the first statement of the domain transaction, and on every success branch save the result (or a checkpoint for a recoverable external call) before commit. Only finalized results expire. An in-progress receipt never expires and is never re-executed automatically, and a 5xx keeps the reservation until explicit reconciliation. Distinguish two modes:
  - Transactional endpoints, where the receipt is locked as the first statement of the domain transaction: a same-key retry waits on the receipt lock, replays the result if the earlier transaction committed, and re-executes only if it rolled back. This is what makes the single same-key retry after a 503 "database busy" safe (ENG-006, ENG-019).
  - Non-transactional endpoints: a same-key retry of an in-progress or unknown receipt gets 409 idempotency-conflict ("in progress or awaiting verification; do not retry with a new key") until reconciliation.

  — _why:_ a lookup followed by asynchronous receipt persistence was a verified race, and a 5xx can follow a commit, so an unknown outcome must never be replayed blindly.
- **ENG-018** `MUST` The frontend sends critical mutations through an idempotent runner:
  - The runner keeps an in-memory map from each intent's fingerprint (user ID + path + method + body) to a randomly generated UUID v4 (`crypto.randomUUID()`), scoped to the user and the live hook instance. The same intent reuses its mapped key.
  - The key stays the same across retries after a network error, a 5xx or an idempotency conflict, and is dropped after success or a definitive 4xx.
  - Keys live in memory only, never in localStorage.
  - The button stays disabled while the request is pending.
  - An uncertain purchase is never retried under a fresh key.

  — _why:_ retrying the same intent must never execute it twice.
- **ENG-019** `SHOULD` When the backend answers 503 "database busy" with `Retry-After`, for transactional idempotent endpoints, the client retries automatically exactly once, after the delay, with the same key, and shows a "server busy, retrying" notice. No other error is retried automatically, and a resource fetch is retried at most once after a network failure. — _why:_ nothing was committed, so one retry with the same key is safe.

## Payments and webhooks

- **ENG-020** `MUST` Before calling an external payment provider, persist a checkpoint with an opaque attempt key and the immutable provider parameters, and reuse them on every retry. An outcome still unknown after the provider's dedup window fails closed and goes to reconciliation. Never mint a new attempt key or delete the checkpoint to force another payment. — _why:_ prevents double charges when the provider's response is lost.
- **ENG-021** `MUST` A payment webhook:
  - passes the signature and mode checks of SEC-046;
  - dedupes on the provider event ID in a processed-events table;
  - answers 200 quickly;
  - returns 500 on a processing error (503 while billing is not configured) so the provider retries.

  Mark the event processed only after processing succeeds. Internal effects stay protected by conditional transitions.
- **ENG-022** `MUST` At confirmation, check amount, currency and owner, and grant benefits only through a conditional pending → paid transition, so concurrent confirmations produce a single grant.
- **ENG-023** `MUST` When an effect has two entry paths (an admin's manual confirmation and a signed provider webhook), both call one service method such as `confirm(id, source)`, and the source is recorded in the audit log. — _why:_ swapping in the real provider later is then just a change of endpoint.
- **ENG-024** `MUST` Before a manual admin confirm or cancel, close any known payable provider session and re-check unresolved attempts under the order lock. Refuse if the provider call fails or the outcome is unresolved. — _why:_ otherwise a checkout can stay payable after manual confirmation.

## State machines and settlement

- **ENG-025** `MUST` Write every "happens once" transition as a conditional update on the expected source status, usually under `FOR UPDATE`: `updateMany({ where: { id, status: { in: allowedFrom }, ...extraAtomicFilters } })`. `count === 0` means someone else already handled it, so return a no-op or 409 without touching anything else. A separate status read before the update does not prevent the race, and a transition is never an update by ID alone.
- **ENG-026** `MUST` Apply the "settlement ticket" rule: only the path whose conditional update returns `count === 1` may move money or balances or emit events. Competing closers (accept vs expire, confirm vs auto-confirm, user vs admin vs webhook vs timeout worker, a double-click) exit as a no-op or 409, so the money effect settles exactly once. — _why:_ concurrent closers otherwise double-refund or double-deliver.
- **ENG-027** `MUST` Route every settlement (ledger consume/refund/debit) through one service function. Forbid direct calls elsewhere with an ESLint `no-restricted-syntax` call selector, plus a file-level override for the single allowed caller. Return the actual outcome (settled / already settled / nothing reserved), not the intent. — _why:_ a second code path risks double settlement.
- **ENG-028** `MUST` Every state-changing operation re-checks the parent's status inside the transaction against an explicit allowed set. A terminal transition closes all competing children in the same transaction.
- **ENG-029** `MUST` Treat coupled state machines as one system. For each transition, document which transitions it forces on the coupled machines, and perform all of them in the same transaction. — _why:_ a transition on one machine almost always requires transitions on the others.
- **ENG-030** `MUST` Every non-terminal state has a defined exit that users can see: a timeout, an auto-transition after N days, or an admin action. Audit state machines for dead ends (expired items, gaps after a terminal acceptance) where records or reserved balances wait forever. — _why:_ dead-end states were repeatedly flagged as launch blockers.
- **ENG-031** `SHOULD` Document technical state machines next to the business ones: the outbox row lifecycle, the idempotency receipt (in progress vs final), uploads (pending upload → pending scan → safe | blocked, where only safe files can be linked) and deployment mode (active/standby).
- **ENG-032** `MUST` An irreversible or paid action (see SEC-048):
  - goes through a confirmation dialog that shows the server-provided cost and consequences, with no option preselected;
  - has a trigger button that is disabled while pending and after success.

  — _why:_ one-click irreversible actions that charged instantly were repeated audit findings.
- **ENG-131** `SHOULD` For actions with costly or irreversible consequences, provide a read-only preview endpoint and require an explicit acknowledgement flag in the body (e.g. `{ acknowledgeX: true }`), checked under the lock before any write.
- **ENG-033** `SHOULD` Expose a compound mutation (e.g. moving an item between groups) as one atomic server endpoint, not as a client-side remove followed by an add. Pair it with optimistic updates and query invalidation.

## Time, timezones and the business calendar

- **ENG-034** `MUST` Store every datetime as `TIMESTAMPTZ` in UTC (`@db.Timestamptz()` on every Prisma `DateTime`).
- **ENG-035** `MUST` Do all business-day and business-hour arithmetic in one `BusinessCalendarService` configured with `<BUSINESS_TZ>`, an IANA zone applied through `Intl.DateTimeFormat`. Never compute business days inline. The service covers:
  - weekends;
  - fixed holidays from a library;
  - movable holidays and admin overrides from a DB holidays table;
  - end of day at 23:59:59.999 local time;
  - tests across DST, holidays and overrides.

  — _why:_ holiday libraries can get movable holidays wrong.
- **ENG-036** `SHOULD` Cache holidays per process. Reload them at boot, on admin change (broadcast to the other processes via Redis pub/sub), and every ~10 minutes as a safety net. Warn when next year's movable dates are missing.
- **ENG-037** `MUST` Decide explicitly for every timer whether it counts wall-clock or business time. Short operational timers (minutes up to a couple of days: grace periods, warnings, assignment windows) use wall-clock hours. Only business deadlines use working days. — _why:_ short operational clocks must be predictable and simple.
- **ENG-038** `MUST` Materialize each deadline into a `<x>_deadline_at` column when the triggering event happens. A recalculation (pause, clarification, extension) updates the column through a worker. Never derive a deadline on every read. Config changes (calendar, tunable business parameters) apply only to new calculations; materialized deadlines and snapshotted values are not recomputed.
- **ENG-039** `GOTCHA` `Intl.DateTimeFormat#formatToParts` does not expose milliseconds. Offset math must truncate the reference instant to the second and, on DST days, refine the wall-clock → UTC conversion a second time. — _why:_ otherwise end-of-day deadlines land about one second after midnight. Unit tests caught this as a real bug.
- **ENG-040** `MUST` Format business dates in the UI with a formatter pinned to `<BUSINESS_TZ>` (e.g. the i18n library's formatter with `timeZone`), never with the browser's `toLocaleString`.
- **ENG-041** `SHOULD` Model rolling-window counters (strikes, points, quotas) as event rows with `expires_at = applied_at + N days`, and compute the threshold as a SUM over unexpired rows. Never use batch resets. — _why:_ an indexable rolling window needs no reset batch.

## Time-based jobs and reconciliation

- **ENG-042** `MUST` Give every waiting state a timed exit: a BullMQ delayed job scheduled when the entity is created, enqueued only after commit, with a deterministic `jobId` built from the entity ID and the deadline timestamp. When the deadline moves (pause, extension), add a job under the new deadline-keyed jobId and remove the old one on a best-effort basis (`.catch()`). If the old job survives, it exits as a no-op because its deadline no longer matches. Never reuse a jobId for a different deadline: BullMQ silently ignores `add()` with an existing jobId, so the old delay would stay in force.
- **ENG-043** `MUST` Job handlers are idempotent. A handler branches on `job.name` and re-reads the current DB state. It returns early if the precondition no longer holds or the deadline moved (a stale job), and otherwise applies the change with a conditional `updateMany` plus a deterministic outbox key. A rerun is a no-op and never fails permanently on a constraint. Keep non-idempotent side effects out of processors. — _why:_ state can change between scheduling and trigger, and a non-idempotent handler kept failing permanently on a CHECK constraint.
- **ENG-044** `MUST` When you add a state, include or exclude it explicitly in the `where` clause of every time-based processor. — _why:_ an active state that a processor never sees produces wrong side effects or zombie records.
- **ENG-045** `MUST NOT` A job never writes directly to another domain's tables and never emits realtime messages. Its side effects go through the existing domain services and the event pipeline.
- **ENG-046** `MUST` Never make Redis the only holder of deadlines. Deadlines live in DB columns, and a reconciliation sweep (hourly and at boot) re-arms due or missing jobs from them. A new state with a deadline therefore needs both a column and a branch in the sweep. Post-commit enqueues use `.catch()` and log "deferred to reconciliation", because the DB status is the durable intent. Idempotency receipts and the outbox also live in the DB, so moving Redis needs no data migration. After a move, re-queue async work left pending (e.g. files still awaiting a scan after 10 minutes). See OPS-071. — _why:_ without the sweep, lost delayed jobs (Redis flush, migration, incident) mean nothing ever expires, silently. With it, losing Redis only delays work.
- **ENG-047** `SHOULD` Recovery and reconciliation jobs paginate past renewed items, so old pages cannot starve later ones, and they retry retained failed timer jobs.

## Domain events, outbox and notifications

- **ENG-049** `MUST` Send all realtime and notification events through one `EventBusService.publish(event, payload, targetUserIds, eventId)`, which emits on Socket.IO and enqueues the notification job. Event names form a typed string-literal union. Controllers, services and jobs never emit sockets directly. Use the Socket.IO Redis adapter from the first sprint.
- **ENG-050** `MUST` Make events durable with an outbox. — _why:_ events survive a crash between commit and publish, and Redis data loss.
  - Write the intent row in the same transaction as the domain change, with `createMany({ skipDuplicates: true })` / `ON CONFLICT DO NOTHING` on a unique event key.
  - Each row holds a metadata-only payload, the target user IDs, `lease_until`, `attempts` and a sanitized `last_error`.
  - Runtime producers only write outbox rows; the outbox dispatcher is the sole caller of `publish`.
  - A repeatable worker sweeps every ~15 s and leases a batch (e.g. 50 rows for 120 s) with a conditional `updateMany` that sets `lease_until` and increments `attempts`.
  - Events still undelivered after ~60 s are replayed.
- **ENG-051** `MUST` Derive event keys deterministically per effect (`<event>:<entityId>:<reason-or-deadlineMs>`). Add a random UUID only when every repetition must notify again, and never reuse a key for a different effect. — _why:_ `ON CONFLICT DO NOTHING` silently swallows the second effect.
- **ENG-052** `GOTCHA` A leasing dispatcher with no attempt cap and no dead-letter path re-delivers a poison row forever. Cap attempts, dead-letter what exceeds the cap, store only a generic error code on the row and log the real cause. — _why:_ external error text can contain signed URLs.
- **ENG-053** `MUST` A private event carries non-empty target user IDs, computed with the same transaction client. It goes only to `user:{id}` rooms or the resource's authorized members. A private event without targets is a no-op, never a broadcast. Add a distinct event type instead of overloading a generic "status changed" event, and inventory every event type to confirm that a consumer handles it. — _why:_ untargeted events were silently dropped, so most lifecycle notifications never went out.
- **ENG-054** `MUST` Payloads carry only entity IDs and status/expiry metadata, including the IDs needed for deep links. They never carry email addresses, personal names, message text, signed URLs or credentials. Resolve display names and titles from current state at delivery time. — _why:_ payloads persist in the database.
- **ENG-055** `MUST` Delivery is at-least-once. Never promise exactly-once email. — _why:_ SMTP has no atomic transaction with PostgreSQL, so a crash between send and marker can resend.
  - Each event has a stable queue job ID (`event-{uuid}`).
  - In-app notifications are unique on `(event_id, user_id)` in the DB.
  - Each email recipient has its own delivery marker.
  - Frontend realtime handlers are idempotent.
  - The notification consumer contains no business logic.
- **ENG-056** `MUST` A post-commit side effect never turns a committed operation into a 500, and a failed enqueue never rolls back a committed action. Outbox replay or reconciliation recovers it.
- **ENG-057** `SHOULD` Send a notification email in the recipient's account language, and only to the other party, never to the sender's teammates. Suppress it when there is no external recipient. Include an HMAC-signed unsubscribe link that works without login, plus an in-app email opt-out toggle.
- **ENG-058** `SHOULD` Track unread state with one read-marker row per user per thread, not one row per message. — _why:_ same result, much cheaper.

## File storage

- **ENG-059** `MUST NOT` Never serve file bytes through an application endpoint, a static URL or an API proxy. One `StorageService` (MinIO in dev, S3 in prod) issues presigned URLs. Downloads are short-lived (~5 min) presigned GETs, issued only after an inline authorization check.
- **ENG-060** `MUST` Uploads follow one flow. Only safe files can be linked or downloaded.
  1. `POST /uploads/presign` validates filename, MIME type, size and target entity, generates the object key server-side, creates an attachment row in a pending-upload state, and returns a ~15-minute presigned PUT.
  2. The client PUTs directly to storage.
  3. `POST /uploads/:id/complete` verifies that the object exists, moves the row to pending-scan and enqueues a scan that ends safe or blocked.

  Limits, sealed scan copies, image re-encoding, download names and decoder caps are in SEC-080 to SEC-085.
- **ENG-061** `MUST` Count per-file and per-entity upload limits under a per-entity advisory lock (the limits themselves: SEC-081). Treat archives as untrusted and give them no preview.
- **ENG-062** `SHOULD` Send client-generated images (e.g. canvas snapshots) through the existing presigned upload flow and attach them to the record, rather than adding a new upload path.

## Money and computed values

- **ENG-063** `MUST` Store money and any internal currency as integer minor units or `NUMERIC`/`Decimal(12,2)`, never FLOAT. Serialize `Decimal` values with `toString()`.
- **ENG-064** `MUST` Derive every computed value (scores, totals, tax) on the server from raw inputs, with decimal arithmetic rounded half-up. The client never sends derived values and only displays backend totals. Validators reject unknown keys, including `__proto__`.
- **ENG-065** `MUST` Compute tax on the taxable base, rounded to 2 decimals half-up, so that base + tax = total. Never extract tax from the total.
- **ENG-066** `MUST` Compute the value shown to a user and the value charged with the same server-side function. Never base a charge on an input the user can freely adjust. — _why:_ otherwise the displayed and charged amounts diverge, and adjustable inputs let one party influence what another pays.
- **ENG-067** `MUST` Values that depend on mutable state or settings at event time (computed scores and costs, the tax rate, the issuer's legal identity and the customer's data on an invoice) are written once into snapshot columns and never updated. Later settings changes and recalculations of derived values do not rewrite them. — _why:_ snapshots are history, and rewriting them falsifies past transactions.
- **ENG-068** `MUST` Number fiscal documents SERIES-NUMBER, sequential and gap-free, allocated inside the issuing transaction under per-series serialization: `pg_advisory_xact_lock(<series key>)` followed by `MAX(number)+1` for that series, or a per-series counter row locked `FOR UPDATE`. Never use an unserialized `MAX()+1`, and never rely on a native Postgres `SEQUENCE` for gap-free numbering, because `nextval` is not rolled back and aborted transactions leave gaps. Hold the series lock only around the numbering step. — _why:_ fiscal numbering must have no gaps or duplicates under concurrency.
- **ENG-069** `GOTCHA` Numbering with `MAX()+1` under an advisory lock must run at READ COMMITTED, not SERIALIZABLE. — _why:_ the serializable snapshot is taken before the lock is acquired.
- **ENG-070** `MUST` Issue an invoice only on confirmed payment (admin confirmation or provider webhook), in the same logical transaction as the confirmation, and make issuance idempotent on the payment ID.
- **ENG-132** `MUST` Generate each invoice document with the minimum fields your jurisdiction requires (`<INVOICE_REQUIRED_FIELDS>`, typically series and number, issue date, full supplier identity, customer name and tax ID, description, taxable base, tax and total), rendered in the recipient's language preference.
- **ENG-071** `MUST NOT` Never delete an issued invoice. Reverse it with a credit note, or mark it cancelled without ever reusing its number.
- **ENG-072** `MUST` Financial tables use real foreign keys with `onDelete: Restrict`, never `Cascade`. Balance columns get `CHECK (>= 0)` (introduced per OPS-037). The ledger is the source of truth, and a scheduled read-only job compares it with cached balances and alerts admins on a mismatch. Polymorphic attachment rows and outbox rows have no foreign keys and reference IDs only. — _why:_ a regression then fails visibly instead of silently corrupting data.

## Data integrity, constraints and soft delete

- **ENG-073** `MUST` Enforce the spec's data constraints in the database and in transactions, never only in app code (see ENG-001, ENG-007, ENG-008, ENG-072). Validate non-overlapping ranges (e.g. date ranges) at the write endpoint before saving.
- **ENG-075** `MUST` Every table holding PII gets a nullable `deleted_at TIMESTAMPTZ`, plus `anonymized_at` where relevant. An anonymization service replaces email, name and phone with hashes and sets `anonymized_at`. The audit log keeps only the user ID.
- **ENG-076** `MUST` Soft delete is a global read policy. — _why:_ manual filtering missed queries, so soft-deleted records stayed actionable and a soft-deleted account kept renewing its session.
  - A Prisma middleware/extension adds `deleted_at IS NULL` to top-level reads of an explicit model list, covered by a spec.
  - The policy covers lists, details, counts, eligibility checks, lock queries, session refresh and the current-user endpoint.
  - Relations, includes and raw SQL are not filtered by the middleware, so filter them explicitly.
  - Bypass it only through a server-side `AsyncLocalStorage` helper that takes a reason from a closed union, never through a request flag.
- **ENG-077** `GOTCHA` `PrismaPromise` is lazy. Await it inside the `AsyncLocalStorage` context instead of returning it out of the context, or the bypass does not apply.
- **ENG-078** `MUST` Discarding a draft is a soft delete allowed only in draft status. Lookups by draft token reject soft-deleted rows, and drafts are excluded from user-facing lists and statistics.
- **ENG-079** `MUST NOT` GET handlers never write: no lazy upserts and no mark-as-read on read. — _why:_ in a blue/green setup, the standby slot serves GETs from the rollback image against the production database.
- **ENG-080** `MUST NOT` Never order rows created in the same transaction by `createdAt`, because they share the timestamp; use an explicit order key. Every paginated list uses a deterministic sort with an ID tiebreak.
- **ENG-133** `SHOULD` Paginate every list API, admin lists included, with `limit/offset`. On the client, use infinite scroll with a "load more" button as fallback.
- **ENG-081** `SHOULD` Enforce a singleton-per-tenant resource with a UNIQUE constraint, and create it lazily with an upsert on first access from a write path (GETs never write, see ENG-079).
- **ENG-082** `SHOULD` When a new variant of an existing resource appears, add a type discriminator enum that defaults to the existing type, and reuse the existing tables and flows (reads, uploads). Generalize the authorization rules for the new variant explicitly.
- **ENG-083** `SHOULD` When other roles need data that lives inside a user's opaque draft JSON, copy it into a dedicated table at submit time instead of reading the draft.
- **ENG-084** `SHOULD` Serve a working view from one context endpoint that returns everything the screen needs in a single call. Include sensitive parts (e.g. a counterparty's contact details) only while the caller holds the state that grants access (e.g. the active assignment on that record), and re-check that state on every call.
- **ENG-085** `AVOID` Avoid destructive migrations when a column stops being used. Leave it in place as legacy, stop reading it, remove its admin input, and document the formula that replaces it.
- **ENG-086** `GOTCHA` Before backfilling from a stored derived column, confirm exactly what it includes (e.g. a total with weights already added) and reverse the extra parts. Write the backfill as a dedicated script.

## Audit log

- **ENG-088** `MUST` Annotate every critical mutation with an `@Audit('domain.action')` decorator, handled by a NestJS interceptor that awaits the audit insert before responding (e.g. via `concatMap`).
  - Record user ID, role, IP hashed with a salt from env, user agent, entity type, entity ID and timestamp.
  - Pass before/after snapshots through an allowlist of non-sensitive fields.
  - Never log passwords, tokens, message content, free text, PII or whole result objects.
  - Store previous values so admin changes can be reverted.
- **ENG-089** `MUST` The audit table is append-only in the database. The migration that creates it adds a `BEFORE UPDATE OR DELETE` trigger that raises an exception, and code never issues UPDATE or DELETE on it. Other immutability rules stay at application level. — _why:_ the trigger plus application-level rules avoids multiple PostgreSQL roles, which are awkward with Prisma.

## Errors: one envelope, one code registry

- **ENG-090** `MUST` Every API error uses one envelope, `{ error: { code, message, details, timestamp, traceId } }`, produced by a global `@Catch()` filter. Codes are UPPER_SNAKE_CASE and come from a const registry in `<SHARED_PKG>` with a derived union type. Services throw `new XxxException({ code, message, details? })`. A 500 never carries a raw message, a stack or provider/ORM error text; log it with kind, route pattern, frame and traceId instead.
- **ENG-091** `MUST` Each module defines its codes with its own prefix (`MODULE_ENTITY_*`) in `<name>.errors.ts`, appends them at the end of the shared registry, and documents them in `<ERROR_CODES_DOC>`. — _why:_ appending at the end avoids merge conflicts.
- **ENG-092** `MUST` Group `<ERROR_CODES_DOC>` by domain, plus a general set: validation, unauthenticated, forbidden, not found (including soft-deleted), rate limited, idempotency conflict (409), database busy (503), concurrent modification (409), deployment standby (503) and internal error. Each entry states the HTTP status, trigger, endpoint(s), `details` shape, whether anything is written, the originating decision ID and the expected frontend behaviour.
- **ENG-093** `SHOULD` Make validation `details` structured and translatable, e.g. `[{ field, messageKey }]` holding i18n keys and IDs. They never contain free text or PII.
- **ENG-094** `MUST` The frontend maps error codes to localized messages, never by the server's `message` text, which is only a fallback. Every code has a message in every locale, in the error namespace of each page that can show it, and a test asserts this.
- **ENG-095** `SHOULD` When a submit fails with structured details (e.g. the IDs of items that are no longer available), use them to remove or unlink the offending items in local state, then let the user resubmit.

Health routes and request/slow-query logging: see OPS-068, OPS-069 and OPS-070.

## Versioned definitions and persisted formats

- **ENG-096** `MUST` Treat published versions of definitions that persisted data depends on (form or question flows, content schemas) as frozen. — _why:_ records created with an older version must keep validating and rendering correctly.
  - A breaking change (removed step, new required field) goes into a new versioned file, registered in the registry with a bumped current-version constant.
  - Old records keep validating against their own version, and the record's version is passed through rendering so old records show their own labels.
  - Unsupported versions are rejected explicitly.
  - Never delete retired seed or config rows that old records still need for recomputation.
  - Purely presentational changes (order, grouping, illustrations) are made in place.
- **ENG-097** `MUST` Reorder or regroup screens without changing stable field IDs, so stored answers and anything keyed on them are unaffected.
- **ENG-098** `MUST` Treat JSON columns as persisted formats. New fields are optional and additive, so old data validates unchanged with no migration, no backend change and no version bump. Any other shape change needs a reader that still handles old rows, plus a backward-reader test before release. Personal data goes into JSON only with a documented reason. — _why:_ after a rollback, the old image must still read data written by the new one.
- **ENG-099** `SHOULD` When retiring enum values, keep them in the enum for already-published data and add a normalizer that migrates old shapes to the new model on read.
- **ENG-100** `SHOULD` When an input moves elsewhere in the UI, keep the old step hidden and optional. Derive the value from the new location, falling back to the legacy answer, so drafts and old records stay valid.
- **ENG-101** `SHOULD` Map a new input experience onto the existing persisted structure (derive the same downstream records), so consumers of that data see no change.
- **ENG-102** `MUST` Version every client-persisted or serialized format. Each older version has a pure, deterministic reader that never mutates its input. Reject unknown or future versions and corrupt current data instead of overwriting them. Keep recovery copies whenever a conversion writes over existing data, never delete them, and move to a new storage key for each major version so the old copy remains for rollback.
  - The client storage adapter throws on unreadable or unsupported data so rehydration does not treat it as missing; after a storage failure it sets a user-visible persistence-error flag and blocks further automatic writes.

  — _why:_ a storage failure must never silently delete the user's saved work.

## Shared domain logic and validation

- **ENG-104** `MUST` Put cross-app TypeScript types, Zod schemas, constants and the error-code registry in `<SHARED_PKG>`, imported by backend, frontend and seeds (see SOT-029). Domain computation (rule and validation engines, derived-value calculators, generators that turn a config into renderable primitives) lives there too, as pure unit-tested functions. UI components only render the result, client stores re-export constants from shared, and interactions are tested visually. — _why:_ the same rules run on both sides, so the UI cannot drift from the server.
- **ENG-105** `MUST` Enforce each domain constraint in three layers at once, and unit-test each layer. — _why:_ users never get stuck in an invalid state, and the server still refuses anything that bypasses the UI.
  - A normalizer silently corrects stored, legacy or client state.
  - The shared schema (`superRefine` on the fully resolved values) rejects violations at the API boundary.
  - The UI hides impossible options and caps steppers live, in every input mode.
- **ENG-106** `SHOULD` Implement alternative entry modes (e.g. bring-your-own spec, partial submit) as options of the single shared validation engine, not as separate validators.
- **ENG-107** `MUST` When the UI locks an invariant, the server re-applies it (normalize, dedupe) on create and on edit, before format validation. — _why:_ the UI blocks; the server guarantees.
- **ENG-108** `MUST` Repeated transfer of client-side structures into server records uses stable source IDs, so a re-send updates instead of duplicating and a double-click on add or submit never creates duplicates. Capacity limits (counts, serialized bytes) are identical on client and server. Byte size is checked before schema parsing, schemas are `.strict()`, and capacity failures are reported before the transfer, never by silently truncating.
- **ENG-109** `GOTCHA` `value || default` turns a legal 0 into the default. Use `??` for counts and any other value where 0 is valid.

## Configuration, feature flags and integrations

- **ENG-110** `SHOULD` Keep tunable business parameters (costs, durations, thresholds, fiscal data) in a key/value settings table that admins edit without a deploy. — _why:_ admins can tune without a deploy, the code fallback cannot diverge from what is displayed, and records already committed keep their terms.
  - Read them through a typed `SettingsService` (`getInt`/`getBool`/`getString` with fallback), with one exported defaults constant shared by enforcement and any public display.
  - The admin endpoint validates each key's value (400 without writing), and changes are audited.
  - Add new keys by migration with `INSERT ... ON CONFLICT (key) DO NOTHING`, defaulting to current behaviour.
  - Read a gating setting inside the same transaction as the locked operation.
  - UI copy, emails and legal pages read these numbers from the server instead of hardcoding them.
  - Snapshot applicable values at commitment time (ENG-067).
- **ENG-111** `SHOULD` Model role permissions as a frozen role → permissions matrix in `<SHARED_PKG>`, with a `can(role, permission)` helper used by guards. Model plan entitlements as data: a plan-feature table where a missing row means disabled and unknown keys are ignored. Enforce them with a guard decorator such as `@RequirePlanFeature(key)` that returns 403 with `details.feature`.
- **ENG-112** `SHOULD` Build features planned for later (e.g. two-factor auth) fully into the architecture: schema, routes, UI, and a real guard wired into the route stack. Keep them inactive behind a feature flag, with the guard a no-op while the flag is off.
- **ENG-114** `SHOULD` Mock complex external integrations (AV scan, payments, invoicing, SMTP, FX) behind the final data model and interface, e.g. a scan job that marks files safe after a delay, or payment confirmation through a signed webhook. Replacing a mock must not need a structural refactor.
- **ENG-115** `MUST` Keep mocks and placeholders in clearly named modules (e.g. `mock-*.ts`), label them in the UI, and list each one in the launch-blocker list. Production rules for mocks and legal placeholders: SEC-049 and SEC-114.
- **ENG-116** `SHOULD` A feature that depends on a third-party API key that is not yet configured falls back to something that works (e.g. a plain input instead of an autocomplete widget) rather than breaking.
- **ENG-117** `MUST` A feature that depends on a browser capability that may be missing (e.g. WebGL) detects it at mount and falls back to the classic UI or a dedicated message. The fallback path stays permanently functional.
- **ENG-118** `SHOULD` Call a rate-limited external lookup provider (e.g. a geocoder) as follows:
  - Call it at write time through a dedicated BullMQ queue throttled to the provider's limit, and store the derived values on the record.
  - Strip noise from the input, search in tiers from the most to the least specific query with a pause between tiers, and fail only when every tier fails.
  - Cache lookups in a DB table keyed by the normalized query including every parameter (e.g. country), with a TTL.
  - Do distance filtering in SQL.
- **ENG-119** `SHOULD` When an autocomplete widget returns a result without structured components (the user pressed Enter without picking a suggestion), fall back to geocoding the typed text and normalize administrative prefixes.
- **ENG-120** `MUST` Wrap telemetry, analytics and error reporting in try/catch and swallow failures. — _why:_ reporting must never break the user flow or the error screen.

Optional integrations default to disabled when unconfigured (see OPS-026, OPS-027).

## Frontend state boundaries

- **ENG-123** `MUST` Each kind of frontend state has one home:
  - Server state lives exclusively in TanStack Query (v5), the single source of truth for API data.
  - Zustand holds only pure UI state: modals, sidebar, UI filters, theme and local pre-submit drafts.
  - React Hook Form holds only in-progress form fields.

  Never copy API data into Zustand. If that ever seems necessary, stop and ask. — _why:_ duplicated server state goes stale, and keeping it in two stores is the most common source of React/TS bugs.
- **ENG-124** `SHOULD` In a multi-step wizard, Zustand holds the current step and the local pre-submit draft (with its server token), React Hook Form holds the current step's fields, and TanStack Query runs the server mutations (create draft, patch, submit). — _why:_ each layer owns one kind of state.
- **ENG-125** `MUST` Implement optimistic updates with TanStack mutation `onMutate`/`onError` (snapshot and rollback), never through the UI store. For a set that users can toggle quickly, roll back with the inverse operation on the affected item instead of restoring a snapshot. — _why:_ restoring a snapshot lets two quick toggles cancel each other out.
- **ENG-126** `SHOULD` Keep one Socket.IO client singleton (`withCredentials`) whose handlers only invalidate TanStack query families and never hold or write data. On an auth-expired event, disconnect, run the shared session refresh, then reconnect; if the refresh fails, drop the non-auth queries instead. Disconnect on logout. — _why:_ realtime stays a cache-invalidation signal, and the REST API remains the source of truth.
- **ENG-127** `SHOULD` Store the last logged-in user ID locally so the logout/user-switch cleanup (SEC-018) runs only when a different user logs in. Work done anonymously survives login (fill in as a guest, log in to submit).
- **ENG-128** `SHOULD` If the stored server token of a resumable draft returns 404 (discarded elsewhere, or DB reset), drop the token, create a new server draft, push the local progress to it, and ask the user whether to continue or start over. The "has progress" check ignores the initial empty step. — _why:_ otherwise the user silently resumes a ghost draft on which every save fails, or sees a resume prompt on an empty wizard.
- **ENG-129** `MUST` Run destructive client-side reconciliation (e.g. pruning references to deleted server files) only against a list query that is `isSuccess` and not `isFetching`, and never while an upload may still be in progress. — _why:_ a partial or refetching list would delete valid references.
- **ENG-130** `SHOULD` A read-only view for another role reuses the same rendering component and interactions but keeps only local view state (selection, open/closed). It never changes the source data and has no editing controls.

## Adapting to a new project

- Fill in the placeholders once: `<INVARIANTS_DOC>` (where these invariants live, referenced from `CLAUDE.md`), `<DECISIONS_LOG>`, `<ERROR_CODES_DOC>`, `<SHARED_PKG>` (the shared types/schemas package) and `<BUSINESS_TZ>`. If you issue invoices, also record the invoicing jurisdiction and its `<INVOICE_REQUIRED_FIELDS>`. Copy the rules you adopt into `<INVARIANTS_DOC>` so the project's own skills and reviews can cite them.
- List the capacity-limited parents and their child tables. Write one reference lock implementation and point every capacity-changing path, including jobs, at it. Decide the transaction profiles and their timeouts.
- List the critical POSTs that need an `Idempotency-Key`, and record which of the five idempotency mechanisms protects each money-moving or state-closing mutation.
- Draw every state machine: allowed transitions, terminal states, the exit for each waiting state, couplings between machines, deadline columns and their reconciliation-sweep branches. Mark each timer as wall-clock or business time, and choose the holiday sources.
- Inventory the domain events with their recipients and consumers. Choose the outbox sweep interval, lease size and duration, attempt cap and dead-letter handling.
- If the stack is not NestJS + Prisma + PostgreSQL, translate the mechanisms: Prisma error codes to your driver's equivalents, middleware to your ORM's hooks, ESLint bans to your linter, BullMQ to your job runner.
- Drop the sections that do not apply (e.g. payments, invoicing or uploads), and record each omission and its reason in `<DECISIONS_LOG>`.
