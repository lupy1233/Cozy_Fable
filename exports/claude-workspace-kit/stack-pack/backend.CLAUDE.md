# Backend (NestJS + Prisma) — local rules

Before writing code here, read `docs/02-technical-invariants.md` (mandatory) and only the relevant section of `docs/03-business-rules.md`. Stack detail lives in `docs/STACK-RULES.md`. Skills: `nestjs-module` (modules, endpoints, guards, DTOs), `prisma-migration` (any schema change), `bullmq-worker` (jobs, timers, deadlines).

## Invariants (non-negotiable)
- Capacity: every operation that consumes or changes a limited shared capacity (slots, stock, seats) runs in a SERIALIZABLE transaction that first locks the parent row with `SELECT ... FOR UPDATE`, with an explicit timeout (e.g. 10 s). Release/cancel/reassign paths and background jobs take the same lock. Retry serialization failures (P2034, SQLSTATE 40001) up to 3x with jitter, then 409 — never 500.
- Transactions open only through one helper with named profiles (isolation, maxWait, timeout, retry). A retrying callback has no side effects: queue adds, emails, socket emits and HTTP calls run after commit.
- Idempotency: critical POSTs (capacity consumption, accept/commit actions, money-bearing creates, irreversible actions, payment webhooks, purchases) require an `Idempotency-Key` header (UUID v4 from the client) via `@Idempotent()`, backed by a dedicated idempotency table (key, user, method + path, request hash, stored response, 24 h dedup). Same key with a different body → 409.
- Time: every datetime is `TIMESTAMPTZ` in UTC. Business-day math only through `BusinessCalendarService` (`<BUSINESS_TZ>`). Deadlines are materialized in `<x>_deadline_at` when the trigger happens and recomputed by a worker, never derived on read. Short operational timers (minutes to ~2 days) count wall-clock hours.
- Files: presigned URLs only, through `StorageService` (MinIO in dev, S3 in prod). Never stream files through a Nest endpoint.
- Events: only via `EventBusService.publish`; controllers never emit Socket.IO directly.
- Errors: one envelope `{ error: { code, message, details, timestamp, traceId } }` from a global filter. Codes are UPPER_SNAKE_CASE from the registry in `<SHARED_PKG>`, documented in `docs/ERROR_CODES.md`. A 500 never leaks stack, ORM or provider text.
- Validation: DTOs with class-validator (or Zod end to end — pick ONE source, record it); global `ValidationPipe` with `whitelist` + `forbidNonWhitelisted`. Every string has a max length.
- Guards: Auth, Roles, `<TENANT>Approved` (account/org status), `SubscriptionActive`, TwoFactor (feature-flagged, no-op when off). Backend guards are the real enforcement.
- Audit: `@Audit('<action>')` on critical actions; the audit table is append-only (DB trigger blocks UPDATE/DELETE). Never write passwords, tokens or message content into it.
- Names: enums, tables, columns VERBATIM from `docs/04-data-model.md`; snake_case in DB via `@map`/`@@map`, camelCase in TS.
- Every non-terminal state has a visible exit (timeout, auto-transition or admin action). No dead ends.

## Workflow
- Missing or conflicting rule → mark DECISION NEEDED and stop. Never invent entities, fields or rules.
- Thin controllers (DTO + one service call); business logic in services; one queue per domain, jobs named `verb.entity`.
- Schema change: new migration (never edit an applied one) + `prisma generate` + rebuild `<SHARED_PKG>`. CHECK constraints, partial unique indexes and triggers live in hand-written SQL.
- Each invariant has a test: concurrent race, idempotent replay, DST/holiday edge. Run `pnpm -F backend test`.

## Gotchas
- `prisma migrate dev` needs a TTY: in agent shells, write the folder by hand with SQL from `prisma migrate diff --from-migrations ... --to-schema-datamodel ... --script`, review it for dropped hand-written objects, then `prisma migrate deploy` + `prisma generate`.
- Check the newest migration timestamp before naming one; parallel branches collide.
- Windows: `prisma generate` fails with EPERM while the dev server holds the engine DLL. Stop it first.
- The apps consume `<SHARED_PKG>`'s built `dist`: rebuild it (and restart the dev server) before typecheck.
- `Intl.DateTimeFormat#formatToParts` drops milliseconds: truncate to the second before offset math.
- Jest + AWS SDK v3 needs `NODE_OPTIONS=--experimental-vm-modules`. In worktrees under `.claude/`, Jest finds 0 tests: pass `--testMatch`.
- BullMQ silently ignores `add` for an existing jobId; retry failed jobs with `job.retry()`.
- Code that reads `process.env` at import time does not see the `.env` the config module loads later.
