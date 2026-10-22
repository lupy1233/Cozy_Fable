---
name: nestjs-module
description: Use this skill when creating or modifying a NestJS module, controller, service, DTO, guard, interceptor, domain event, upload flow or config variable in the backend app, especially endpoints that move money, consume a limited shared capacity or make irreversible state changes ("new endpoint", "new module", "controller", "DTO", "API", "endpoint nou", "modul nou", "serviciu").
---

# NestJS module conventions

Layering, guard stack, validation and the race-safe recipe for critical mutations in `apps/backend` (NestJS + Prisma + PostgreSQL, Redis/BullMQ, S3-compatible storage). Rule IDs point to the kit: WM = 01, DEL = 03, ENG = 04, QA = 05, SEC = 06, MEM = 08, OPS = 09, ENV = 10, STK = STACK-RULES.

## When to use

- New or changed module, controller, service, DTO, guard or interceptor under `apps/backend/src/modules/`.
- Any endpoint that moves money, consumes a limited shared capacity (slots, stock, seats), accepts/commits, or cannot be undone: it follows the critical-mutation recipe (step 6).
- A new domain event, upload flow, env variable or worker registration.
- Not here: schema and migrations (`prisma-migration`), processors and timers (`bullmq-worker`), frontend (`ui-component`), locale texts for new error codes (`i18n-copy-change`). Closure runs `security-close`.

## Read first

- `docs/02-technical-invariants.md` (`<INVARIANTS_DOC>`): only the concurrency, idempotency, storage and auth sections the change touches.
- `docs/04-data-model.md` (`<DATA_MODEL_DOC>`): entity, column and enum names, used verbatim.
- `docs/07-decisions-log.md` (`<DECISIONS_LOG>`): decisions are final; never reopen them.
- `<ERROR_CODES_DOC>` (e.g. `ERROR_CODES.md`) and the error-code registry in `<SHARED_PKG>`.
- The reference implementations you will copy: the tx helper and its profiles, the idempotency helpers, `<REFERENCE_LOCK_IMPL>` (the existing parent-row lock, ENG-002). If the project keeps a knowledge vault, the module note and the "new endpoint" IMPACT playbook (MEM-015, MEM-020).

## Procedure

1. **Declare scope** before coding (DEL-006): routes (method, path, guards), tables touched, events, jobs, and for each mutation whether it is plain or critical. A missing entity, rule or field → `DECISION NEEDED`, stop (WM-001).
2. **Layout** (STK-010): `modules/<name>/` holds `<name>.module.ts`, `<name>.controller.ts`, `<name>.service.ts`, `dto/`, `guards/` (module-specific only), `events/` (payload types) and `<name>.errors.ts`. Specs, processors and helpers sit next to their code.
3. **Error codes** (ENG-090 to ENG-094): UPPER_SNAKE with the module prefix in `<name>.errors.ts`, appended at the END of the shared registry, documented in `<ERROR_CODES_DOC>` (HTTP status, trigger, endpoints, `details` shape, whether anything is written, decision ID, frontend behaviour), with an `apiErrors.<CODE>` message in every locale. Services throw the typed exception with `{ code, message, details? }`; `details` holds ids and i18n keys, never free text or PII. Rebuild the shared package, then restart the backend (STK-004).
4. **DTOs** (SEC-038 to SEC-040, STK-013): use the validation source chosen under STK-016 (class-validator mirrored by the shared Zod schema, or Zod end to end) under the global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`); a max length on every string; numbers bounded to the column type; `@IsEnum` on enum query params; `ParseUUIDPipe` on every id param. Deep JSON: check a byte limit first, then parse with the shared strict Zod schema in the service (ENG-108).
5. **Controller** (STK-011, STK-014, SEC-026): keep the global guard order (deployment standby → throttler → JWT auth → roles); add tenant, entitlement or 2FA guards per controller with `@UseGuards`; read context through `@CurrentX()` decorators. The handler body is one service call. Static routes go before `@Get(':id')` (STK-018). `@Public()` only with a written reason and its own `@Throttle` (SEC-028).
6. **Critical mutation recipe** (SEC-044, SEC-045, ENG-014 to ENG-017):
   ```ts
   @UseInterceptors(AuditInterceptor)        // class level; the audit interceptor is not global (ENG-088, SEC-052)
   // ...
   @Post(':id/<action>')
   @Audit('<domain>.<action>')
   @Throttle({ default: { limit: <N>, ttl: 60_000 } })
   @Idempotent({ transactional: true })      // receipt locked inside the domain tx (ENG-017)
   @UseInterceptors(IdempotencyInterceptor)
   ```
   In the service, `runTx(prisma, '<capacity|critical>', async (tx) => { ... })` (ENG-003: SERIALIZABLE + retry, explicit timeout):
   1. Before the tx and before any external call: validation, policy and rate checks, plus the client's expected-version check, so a refusal writes nothing (ENG-009, ENG-010).
   2. First statement: lock the idempotency receipt (e.g. `lockIdempotentOperation(tx)`) (ENG-017).
   3. `SELECT ... FOR UPDATE` the parent row through parameterized `$queryRaw` (ENG-001, SEC-041). No parent row → `pg_advisory_xact_lock(hashtextextended('<type>:<id>', 0))` before counting (ENG-007).
   4. Under the lock, re-check: status in the allowed set, not soft-deleted, active children under the cap, "at most one open" invariants (backed by a partial unique index), actor eligible, expected version still current (ENG-001, ENG-008, ENG-009, ENG-028).
   5. Transition with `updateMany({ where: { id, status: { in: allowedFrom } } })`; act only on `count === 1`, otherwise no-op or 409 (ENG-025, ENG-026). A terminal transition closes competing children in the same tx (ENG-028). Money moves only through the single settlement function (ENG-027).
   6. Write the outbox row in the tx: deterministic key `<event>:<entityId>:<reason-or-deadlineMs>`, ids-only payload, non-empty target user ids computed with `tx` (ENG-050, ENG-051, ENG-053).
   7. Save the idempotent result before commit on every success branch (e.g. `saveIdempotentResult(tx, result)`) (ENG-017).
   8. After commit: enqueue jobs with deterministic jobIds and `.catch()` that logs "deferred to reconciliation"; the reconciliation sweep recovers lost enqueues (ENG-042, ENG-046, ENG-056).
7. **DB error handling** (ENG-004, ENG-006, ENG-008, STK-032): the tx helper retries `P2034` (and `P2010` with SQLSTATE `40001`/`40P01`) 3 times with 20–80 ms jitter, then returns a retryable 409; the global filter turns `P2028`/`P2024`/`P1001`/`P1017` into 503 "database busy" with `Retry-After`, and an escaped `P2002` into a 409 whose log names only the constraint. Do not catch these and rethrow them as 500; map an expected `P2002` (e.g. a partial unique index) to its dedicated 409 code.
8. **Events** (ENG-049, ENG-053 to ENG-055): one distinct literal in the event-name union per event, never an overloaded "status changed"; payload = ids plus status/expiry metadata; consumers dedupe on `(event_id, user_id)`; confirm a consumer handles the new type.
9. **Files** (ENG-059 to ENG-061, SEC-080 to SEC-085): presign (MIME allowlist and size bound into the signature, server-generated key, pending row) → client PUTs directly to storage → complete (HEAD, compare size and MIME, `CopySourceIfMatch` to a sealed neutral key) → scan job → short-lived presigned GET only after authorization and SAFE status. Count caps under the per-entity advisory lock.
10. **Config** (SEC-064 to SEC-070): add the var to the Zod config schema with a deliberate required/optional choice; production rules in `superRefine`, one spec case each; a placeholder in `.env.example`; read secrets with `getOrThrow`; never log or echo values; set it on every deployment slot before the release that needs it (OPS-026).
11. **Workers**: in an active/standby deployment, register processors and schedulers only through the active-only registration helper, and add the module to the "standby registers none" spec (OPS-045, OPS-046). Processor rules: `bullmq-worker`.
12. **Logging and audit** (SEC-051, SEC-053, SEC-057): log ids plus a safe error summary (e.g. `safeErrorSummary(e)`); a new field enters the audit-snapshot allowlist only after a sensitivity review; add each audited route to the audit-wiring spec; write the audit row inside the domain tx where an audit gap is unacceptable.
13. **Tests** (QA-013 to QA-018, QA-021, SEC-003): unit specs with mocked Prisma (`$transaction: jest.fn((fn) => fn(tx))`), typed service factories and frozen modern fake timers; a minimal e2e per endpoint (happy path + at least one edge case); the `count === 0` race per transition; isolation: wrong role → 403, other tenant → 404. Changes touching transactions, idempotency, soft delete or uploads add `*.integration.spec.ts` on an env-gated, host-guarded real Postgres (QA-014, QA-026, QA-027): `Promise.allSettled` races repeated over iterations, `--runInBand`, optional latency injected by a test-only Prisma middleware; assert invariants (one effect, counts, balanced ledger), never the winner (QA-032, QA-033).
14. **Verify** (QA-002, QA-042, QA-043, QA-045): shared build → typecheck → lint → tests. Poll the watch-mode log for the boot marker or a failure signature, then curl the endpoints with a cookie jar: happy path, 400 on a bad UUID or unknown field, 404 on a foreign id, same-key replay returns the original response.

## Rules

- MUST keep business logic, ORM access and event publishing in services; controllers only validate and delegate (STK-011).
- MUST check ownership or tenancy for every `:id`, nested ones included, in the service before any other read; a non-owner gets 404, a wrong role 403 (SEC-030, SEC-031).
- MUST open every interactive transaction through the tx helper with a named profile; no direct `$transaction` (ENG-003).
- MUST route every path that changes a capped parent's active children (create, release, cancel, reassign, jobs) through the same parent-row lock (ENG-002).
- MUST give every critical POST `@Audit` + `@Throttle` + `@Idempotent` with both interceptors applied, and a test for replay and the race (SEC-044, ENG-015, ENG-088).
- MUST NOT write in a GET handler: no lazy upserts, no mark-as-read (ENG-079).
- MUST NOT put queue adds, HTTP calls, emails, socket emits or outer-variable mutations inside a retrying tx callback; no queue or socket I/O inside money transactions (ENG-005).
- MUST NOT emit sockets from controllers, services or jobs; events go through the outbox and the event bus (ENG-049, ENG-050).
- MUST NOT put emails, names, free text, signed URLs or credentials in event payloads, logs or audit rows (ENG-054, SEC-057).
- MUST NOT serve file bytes through an app endpoint or proxy (ENG-059).

## Done checklist

- [ ] Scope declared: routes with guards, tables, events, jobs, critical vs plain.
- [ ] Layout per STK-010; controller is DTO + one service call.
- [ ] New codes in `<name>.errors.ts`, the shared registry (appended), `<ERROR_CODES_DOC>` and every locale.
- [ ] DTOs: whitelist, max lengths, numeric bounds, `@IsEnum` queries, `ParseUUIDPipe` ids; deep JSON byte-limited.
- [ ] Ownership check per `:id`; isolation test (403 role, 404 tenant).
- [ ] Critical mutations: decorators + interceptors, receipt lock first, parent `FOR UPDATE`, conditional `updateMany`, outbox in tx, result saved before commit, post-commit enqueue with `.catch()`.
- [ ] DB errors end as 409/503 with retryable codes, never 500.
- [ ] Env vars in schema + `superRefine` spec + `.env.example`; workers registered for active mode only.
- [ ] Unit specs and per-endpoint e2e green; real-Postgres integration specs for transaction, idempotency, soft-delete or upload changes, counts reported separately from skipped gated suites (QA-075).
- [ ] Gates green in order; endpoints curl-smoked after the restart.

## Pitfalls

- `forbidNonWhitelisted` turns an `id` in a PATCH body into a 400 (STK-015).
- `@Public()` alone under a class-level `@Roles(...)` still returns 403; add an empty `@Roles()` (STK-018).
- NestJS 11 / Express 5: the query parser no longer builds objects from `a[b]=`, and wildcard routes need a name (`{*path}`) (STK-019).
- An audit decorator without its interceptor records nothing; check that rows appear (SEC-052).
- A status read followed by an update by id does not prevent the race; only the conditional `updateMany` does (ENG-025).
- Throwing inside the callback rolls back a defensive write; return a sentinel and throw after commit (ENG-011).
- Interactive transactions time out at 5 s by default (`P2028`); count round-trips and batch with `createMany`, never raise the capacity timeout to absorb latency (ENG-003, ENG-012).
- Raw SQL: Prisma string ids are TEXT (no `::uuid`), cast enums `::text`, columns come back snake_case, and `P2002` on a partial index lists columns, not the index name (STK-034).
- The soft-delete middleware filters only top-level reads; relations, includes, raw SQL and lock queries need explicit filters, and a lazy `PrismaPromise` must be awaited inside the bypass context (ENG-076, ENG-077).
- A reused outbox key with `ON CONFLICT DO NOTHING` silently swallows the second effect (ENG-051).
- BullMQ silently ignores `add()` with an existing jobId, and custom jobIds must not contain `:`, so never reuse the colon-separated outbox key as a jobId (STK-038).
- Config read at module import runs before dotenv and may fall back to a wildcard (SEC-068, ENV-029).
- Jest passes against `src` while typecheck reads the stale shared `dist`; rebuild shared first (STK-004, ENV-027).
- Calling the API before the watch-mode restart finishes tests the old build (QA-042).
