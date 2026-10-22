---
name: bullmq-worker
description: Use this skill when creating or modifying BullMQ queues, workers, delayed or repeatable jobs, reconciliation sweeps, or any time-based logic such as deadlines, expirations, reminders, auto-cancel, grace periods, scheduled emails or business-day calculations ("job", "queue", "worker", "deadline", "expiry", "reminder", "coada", "termen", "expirare", "zile lucratoare").
---

# BullMQ workers and time-based logic

Delayed and repeatable jobs, materialized deadlines and the reconciliation sweep in `apps/backend` (NestJS + Prisma + PostgreSQL, Redis/BullMQ). Rule IDs point to the kit: ENG = 04, QA = 05, SEC = 06, MEM = 08, OPS = 09, STK = STACK-RULES.

## When to use
- Adding a queue, a job name, a processor, a delayed job or a repeatable (cron) job.
- Adding any waiting state, deadline, expiry, reminder, grace period or auto-transition, even on an existing queue.
- Changing how a deadline is computed, paused, extended or cancelled.
- Adding a branch to the reconciliation sweep, or an email sent from a job.
- Not here: the deadline column and its index (`prisma-migration`), the endpoint that starts the timer (`nestjs-module`), countdowns in the UI (`ui-component`).

## Read first
- `docs/02-technical-invariants.md` (`<INVARIANTS_DOC>`): the locking, time and business-calendar, time-based-jobs and outbox sections (ENG-001, ENG-002, ENG-034 to ENG-047, ENG-050).
- `docs/03-business-rules.md` (`<BUSINESS_RULES_DOC>`): the timers table (clock type, duration or settings key, start, exit) and the state-machine table (allowed next states, exit if nothing happens, deadline column).
- `docs/04-data-model.md` (`<DATA_MODEL_DOC>`): the entity's statuses and its `<x>_deadline_at` columns. Use the names verbatim.
- `docs/07-decisions-log.md` (`<DECISIONS_LOG>`): decisions on this state machine and its timers. They are final.
- In code: the queue-name constants in the global `QueuesModule`, `<REFERENCE_PROCESSOR>` (an existing processor to copy), `<REFERENCE_LOCK_IMPL>` for the capacity lock, the reconciliation sweep, `BusinessCalendarService`, the `runTx` profiles, the outbox writer and the active-only registration helper.
- If the project keeps a knowledge vault, read the deadlines/jobs concept note and its IMPACT playbook (MEM-019, MEM-020).

## Procedure
1. Declare the scope before you write code (DEL-006): the queue, job names, entity, source and target states, the deadline column, the clock type of each timer, the cancel paths, the sweep branch and the effects (events, emails, money). Every timer must already be in the timers table and every state in the state-machine table. If a state, column, duration or clock type is missing, mark it **DECISION NEEDED** and stop (WM-001).
2. Schema (use the `prisma-migration` skill): add `<x>_deadline_at` as `TIMESTAMPTZ` in UTC. It is nullable on populated tables and indexed, because jobs scan it (ENG-034, STK-026, STK-027).
3. Queue: use one queue per domain. Add its name constant to the global `QueuesModule` and register it with `registerQueue`. Name jobs `verb.entity`, e.g. `expire.reservation` (STK-035). Job defaults are `attempts: 3`, exponential backoff of 2000 ms and `removeOnFail: 1000` (STK-036).
4. Compute the deadline when the triggering event happens, in the same transaction that changes the state, and write it to the column (ENG-038):
   - Short operational timers (minutes up to about two days: grace periods, warnings, windows) count wall-clock time (ENG-037).
   - Business deadlines call `BusinessCalendarService` in `<BUSINESS_TZ>`. It uses the holiday library plus the DB holidays table, and end of day is 23:59:59.999 local time (ENG-035).
5. Enqueue after commit, never inside the `runTx` callback (ENG-005):
   ```ts
   const deadlineMs = deadlineAt.getTime();
   await queue
     .add('expire.<entity>', { id, deadlineMs }, {
       jobId: `<kind>-${id}-${deadlineMs}`, // deterministic, no ':'
       delay: Math.max(0, deadlineMs - Date.now()),
     })
     .catch((e) => logger.warn(`enqueue failed, deferred to reconciliation (${e?.name})`));
   ```
   A failed enqueue never turns the committed operation into a 500 (ENG-046, ENG-056).
6. When the deadline moves (pause, extension, recalculation), update the column, add the job under the new deadline-keyed jobId and remove the old job on a best-effort basis (`.catch()`). Every cancel or close path removes the pending job as well (ENG-042).
7. Write the processor:
   - Register it through the active-only helper, so the standby deployment registers no processors, and add the module to the "standby registers none" spec (OPS-045, OPS-046).
   - Branch on `job.name`.
   - Re-read the row. If it is missing, isn't in the expected status, or its deadline no longer equals `job.data.deadlineMs`, the job is stale and returns as a no-op (ENG-043).
   - If the job changes a limited shared capacity, take the same parent `SELECT ... FOR UPDATE` lock as the synchronous path, copied from `<REFERENCE_LOCK_IMPL>` (ENG-001, ENG-002).
   - Apply the change in `runTx` with a conditional `updateMany({ where: { id, status: { in: allowedFrom }, ...deadlineMatch } })`. `count === 0` means someone else closed it, so do nothing. Only the `count === 1` path may move money or emit events (ENG-025, ENG-026).
   - In the same transaction, write the outbox row with a deterministic key such as `<event>:<id>:<deadlineMs>` and `skipDuplicates` (ENG-050, ENG-051).
   - Route effects through the existing domain services (the single settlement function, notifications) and the event bus (ENG-027, ENG-045, ENG-049).
   - A job that moves money writes its audit-log entry itself, through the audit service with an allowlisted snapshot. The HTTP `@Audit` interceptor does not run for processors (STK-036, SEC-053).
8. Reconciliation: add a branch to the sweep that runs hourly and at boot. It selects rows in the waiting state by the deadline column and re-arms missing or due jobs with the same deterministic jobId, so jobs that already exist stay untouched. It paginates past renewed items and retries retained failed timer jobs. The outbox key dedupes effects if both the job and the sweep fire (ENG-046, ENG-047).
9. Exit check: every waiting state you touched has a visible exit (timeout, auto-transition or admin action), and every time-based processor's `where` includes or excludes any new state explicitly (ENG-030, ENG-044).
10. Emails sent from jobs are rendered in the recipient's stored locale, HTML-escape every interpolated value and honour the opt-out and unsubscribe link (transactional and security emails ignore the opt-out). Let SMTP errors propagate so the per-recipient job retries. Delivery is at-least-once, with a delivery marker per recipient (STK-022, SEC-043, SEC-117, ENG-055).
11. Write the tests (see the checklist). Run the gates in order and record the test counts (QA-002, QA-003), then update the CHANGELOG (DEL-010) and the vault note.

## Rules
- **MUST** store every datetime as `TIMESTAMPTZ` in UTC and materialize each deadline in a `<x>_deadline_at` column when the triggering event happens. **MUST NOT** derive a deadline on every read (ENG-034, ENG-038).
- **MUST** decide for each timer whether it counts wall-clock or business time. **MUST NOT** compute business days inline. They come only from `BusinessCalendarService` (ENG-035, ENG-037).
- **MUST** enqueue after commit with a deterministic jobId `<kind>-<entityId>-<deadlineMs>` and `delay = max(0, deadline - now)`. **MUST NOT** add queue jobs inside a retrying transaction callback (ENG-005, ENG-042).
- **MUST** remove the old job and add a new one when the deadline changes, and remove the job on every cancel path. **MUST NOT** add a second job for the same deadline or reuse a jobId for a different deadline (ENG-042, STK-038).
- **MUST** keep handlers idempotent: re-read the state, exit on a stale job, apply a conditional `updateMany` plus a deterministic outbox key. A rerun is a no-op and never fails permanently on a constraint (ENG-043).
- **MUST** use the synchronous path's parent-row lock whenever a job changes shared capacity (ENG-002).
- **MUST NOT** write another domain's tables or emit socket messages from a job (ENG-045, ENG-049).
- **MUST NOT** let Redis be the only holder of a deadline. Every deadline column has a reconciliation branch (ENG-046).
- **MUST** register processors and repeatable schedulers only in active deployment mode (OPS-045, OPS-046).
- **MUST** keep failures visible: retained failed jobs show in the admin jobs view, and jobs that move money are audit-logged (STK-036).
- **MUST** keep job data to the entity ID and `deadlineMs`. The handler re-reads everything else from the database (ENG-043), and, like event payloads, job data never carries emails, names or free text (ENG-054).
- **SHOULD** add repeatable jobs in `onModuleInit` with stable keys and staggered cron minutes, plus a heartbeat that re-arms them after Redis loses its state (STK-037).

## Done checklist
- [ ] Scope declared. Every state, column, duration and clock type exists in the docs, or a DECISION NEEDED is open and the work has stopped.
- [ ] The deadline column is `TIMESTAMPTZ`, indexed and written at the triggering event.
- [ ] The queue constant is registered, job names are `verb.entity`, and the defaults are 3 attempts with exponential backoff.
- [ ] The enqueue happens after commit with a deterministic jobId without `:`. Reschedule and every cancel path remove the old job.
- [ ] The processor is active-only, branches on `job.name`, exits on stale jobs, uses the conditional update plus the outbox key, and routes effects through services and the event bus.
- [ ] The reconciliation sweep has a branch for the new deadline. Every waiting state has an exit.
- [ ] Tests with a frozen clock or time travel cover: the boundary instant (one ms before and at the deadline), DST transitions and holidays for business-day timers, a stale job after a deadline move, a state change between scheduling and trigger, a rerun of the same job, and a double sweep that produces exactly one effect (QA-017, QA-018, QA-019, ENG-035).
- [ ] Gates green in order with test counts recorded. CHANGELOG and vault note updated.

## Pitfalls
- BullMQ silently ignores `add()` when the jobId already exists, so a reused jobId keeps the old delay. Retry a failed job with `job.retry()`. A self-rescheduling job needs a jobId different from the one still active (STK-038).
- Keep `:` out of custom jobIds. Outbox event keys live in the database and may use `:`. Don't mix the two formats (STK-038, ENG-051).
- `Intl.DateTimeFormat#formatToParts` has no milliseconds. Truncate to the second and refine the wall-clock to UTC conversion a second time on DST days, or end-of-day deadlines land one second after midnight (ENG-039).
- Holiday libraries can get movable holidays wrong, so keep them in the DB table and warn when next year's dates are missing (ENG-035, ENG-036).
- Changes to calendar or settings apply only to new calculations. Never recompute materialized deadlines (ENG-038).
- Renaming a job or changing its data shape is a rollback-compatibility change: the previous release must still be able to process jobs the new one queued (OPS-055).
- Unit specs use modern fake timers but keep `nextTick`, `setImmediate` and `queueMicrotask` real. Integration specs can't fake the database's `now()`, so back-date the columns instead (QA-018).
- One sweep that re-arms deadlines for several modules is a hidden coupling. Document it in the vault (MEM-021).
- After a Redis flush or move, check that the heartbeat, the outbox replay and the sweep restored all pending work (OPS-071).
- Show deadlines in the UI with a formatter pinned to `<BUSINESS_TZ>` and a ticking `useNow`, never with the browser's `toLocaleString` (ENG-040, STK-107).
- On IPv6 private networking (e.g. Railway), every BullMQ connection needs the Redis password plus `family: 0` (OPS-097).
