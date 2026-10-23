---
name: security-close
description: Use this skill when closing a sprint or work package, before proposing a commit, before a deploy, or when the user asks for a security review or hardening pass ("security review", "hardening", "verifica securitatea", "inchide sprintul"). Runs a PASS/FAIL/N/A checklist over the diff (untracked files included), patches only the failures, re-runs the gates and records the result in the CHANGELOG.
---

# Security close

Closing security review of the current diff (SEC-001, SEC-002). Output: a verdict per check with evidence, minimal patches for the FAILs, and a CHANGELOG record. Rule IDs in parentheses refer to the workspace rule chapters. Mechanism names below (guards, decorators, pipes, Prisma, pnpm) are those of the default NestJS + Prisma + Next.js stack; on another stack, check the same intent with the mapped mechanism (guard → middleware, class-validator → your schema validator).

## When to use

- At the end of every sprint or package, before the CHANGELOG entry is final (DEL-011, "Security close" section).
- Before proposing any commit (SEC-001), and before a deploy, in addition to the exact-SHA CI gate (OPS-031) and the pre-deploy security review (SEC-118).
- When asked: "security review", "hardening", "verifica securitatea", "inchide sprintul".
- As the closer agent of a multi-agent sprint: fix what this checklist finds and list the rest (DEL-033).

## Read first

- `docs/workspace-rules/06-security-baseline.md`: the full text of every SEC rule cited below.
- `docs/02-technical-invariants.md` (`<INVARIANTS_DOC>`): concurrency, idempotency, storage, auth, state boundaries.
- `docs/07-decisions-log.md` (`<DECISIONS_LOG>`): final decisions; never reopen them (SOT-016).
- `<ERROR_CODES_DOC>` and the shared registry `<ERROR_CODES>`.
- The project's filled-in limits: rate-limit tiers, `<MAX_UPLOAD_BYTES>`, per-parent caps, `<MAX_JSON_BYTES>`, `<LOCALES>`.
- The sprint scope block (DEL-006) and the package's "done when" list.
- The local skills for the layers the diff touches (DEL-007).

## Procedure

1. **Scope from the diff.** Run:
   ```
   git status --porcelain
   git diff --stat HEAD
   git ls-files --others --exclude-standard
   ```
   Read every new untracked file in full. List, with paths: new or changed endpoints (method, route, guards), mutations, uploads, event producers (outbox writes), jobs/workers, and logging/audit boundaries (new logger calls, audit decorators, error-tracker tags, queue payloads). This list is the review's stated scope.
2. **Run the 11 checks.** For each one, give `PASS`, `FAIL` or `N/A`, with evidence as `path:line` plus the rule that proves it. An N/A needs a one-line reason ("no uploads in diff").
   1. **Guard chain.** Every new route sits behind the global chain in its fixed order (throttler, authentication, roles; deployment-standby first under blue/green) plus the per-route guards its flow needs (tenant approval or manager, active entitlement, 2FA) (SEC-026). A public route (`@Public()`) only with a written justification and its own throttle (SEC-028). Admin routes: admin role, audit decorator and audit interceptor (SEC-029).
   2. **Ownership and input.** Every `:id`, nested ones included, is ownership- or tenancy-checked in the service before any other read; a non-owner gets 404, a wrong role gets 403 (SEC-030, SEC-031), and an isolation test covers both (SEC-003). Unknown fields are rejected (`whitelist` + `forbidNonWhitelisted`), every string has a max length, id and enum params/query values are validated (e.g. `ParseUUIDPipe`, `@IsEnum`), numeric bounds match the column type, the DTO is mirrored by the shared schema, and deep JSON is validated in the service with a `<MAX_JSON_BYTES>` limit (SEC-038 to SEC-040). Fields an audience must not see are masked server-side in role-specific DTOs (SEC-032).
   3. **Rate limits.** Credential routes, capacity-consuming or money-moving actions, admin mutations, uploads and expensive renders have their tier, and session refresh keeps its own looser one (SEC-020). Per-user throttles run after the auth guard. Auth changes keep the per-account lockout (SEC-024).
   4. **Critical mutations.** Money, scarce-capacity and irreversible actions require an `Idempotency-Key` (e.g. `@Idempotent()`) and a throttle, a conditional transition on the allowed source status where only the `count === 1` path proceeds, and settlement only through the single settlement function (SEC-044, SEC-045, ENG-014 to ENG-017, ENG-025 to ENG-027). Tests cover replay and the `count === 0` race (QA-016) against real PostgreSQL; a mocked transaction is not evidence (QA-014, QA-032). Irreversible user actions have a confirmation step in the UI (SEC-048).
   5. **Audit and log hygiene.** Each critical mutation has the audit decorator with its interceptor really applied, and is listed in the audit-wiring spec (ENG-088, SEC-051). Snapshots come from a key allowlist (SEC-053). No passwords, tokens, private text, contact data, raw errors, full URLs or bodies in audit rows, logs, queue/outbox payloads or the error tracker (SEC-057, ENG-054, SEC-060). The logger lint rule still passes (SEC-058).
   6. **Files.** Bytes move only through presigned URLs; the object key is generated server-side, and the allowlisted MIME and the size are bound into the PUT signature (ENG-059, ENG-060, SEC-080). Completion HEADs the object against the declared size and MIME and makes a sealed copy before the scan (SEC-082); downloads are served only after scan status SAFE (SEC-080). Size and count caps are counted under the per-entity advisory lock (SEC-081, ENG-061). Stored keys and download names never carry a user filename or PII (SEC-084). A mock scanner is stated as a mock (SEC-083).
   7. **Secrets.** New secrets live only in env, are validated at boot by the config schema with a deliberate required/optional choice and no hardcoded fallback, and cross-variable rules have a spec case (SEC-064, SEC-065). `.env.example` gains placeholders only (SEC-069). Seed and demo scripts hold no password literals (SEC-074). The secret scan over the files to be committed ends with 0 findings (SEC-108, SEC-109).
   8. **Errors.** The single envelope with a registry code; every new code is in `<ERROR_CODES_DOC>` and has a message in every locale (SEC-088, ENG-092, ENG-094, QA-070). No stack traces, internals or provider text in production responses or logs.
   9. **Browser boundary.** Auth cookies stay httpOnly, Secure in production, SameSite=Lax; nothing auth-related in localStorage or sessionStorage (SEC-004). The CORS allowlist (REST and WebSocket) and CSP sources are unchanged, or the change is justified and made in the central CSP builder (SEC-090, SEC-093, SEC-094).
   10. **Reads and rendering.** New reads apply the soft-delete policy, and relations, includes and raw SQL filter explicitly (ENG-076). Emails and PDFs HTML-escape every interpolated value (SEC-043).
   11. **Parity and dependencies.** The i18n parity script shows equal key counts, 0 missing and 0 owner-banned terms (QA-067). `pnpm audit --prod --audit-level high` and the full `pnpm audit --audit-level high` are clean, or each advisory has a recorded disposition and fixed version (SEC-100, SEC-102).
3. **Separate pass: payment flows and event producers** (N/A with reason if untouched):
   - validation, policy and rate-limit checks run before any external call and before the transaction (ENG-010);
   - a checkpoint with an opaque attempt key is persisted before the provider call and reused on retry; an unknown outcome fails closed to reconciliation (ENG-020);
   - payment keys are validated at boot, and test mode is allowed only behind an explicit flag (SEC-047);
   - webhooks verify the raw-body signature with `timingSafeEqual`, check live/test mode and dedupe on the provider event id, marking it processed only after success (SEC-046, ENG-021); benefits are granted only via a conditional pending to paid transition (ENG-022);
   - outbox rows are written inside the domain transaction, with a deterministic event key, a metadata-only payload and non-empty targets for private events (ENG-050, ENG-051, ENG-053, ENG-054);
   - retrying transaction callbacks have no external effects (ENG-005); a post-commit failure never becomes a 500 (ENG-056).
4. **Patch only the FAILs.** Make the smallest change that turns the check to PASS, and add a test for every behavioural fix. If a fix would change a business rule, an invariant or a final decision, record that item as `DECISION NEEDED` (`decision-gate` skill) and stop it (WM-001, WM-004, SOT-016).
5. **Re-run the gates** in order: shared build, `pnpm typecheck`, `pnpm lint`, then the tests of the touched packages (the full backend suite when you are the closer) (QA-002, QA-003). Record exit codes and counts; list skipped gated suites separately (QA-075).
6. **Record** in the sprint's CHANGELOG entry, section "Security close" (DEL-011): the scope line, the 11-row verdict table, a "Fixed at closure" list (check number, file, test) and "Residual risks" (SEC-002). As the closer agent, return security findings, fixes made, whether the CHANGELOG entry was added, the proposed commit message and decisions needed (DEL-034).
7. **Stop at the commit.** Propose the commit message and exact command; never commit, push or deploy (WM-021, WM-022).

## Rules

- MUST back every PASS with concrete evidence and a stated scope; "looks fine" is not evidence, and a PASS is never a pen test or a release authorization (SEC-002).
- MUST list residual risks explicitly: routes outside the diff, interceptor audit not transactional with the commit (SEC-051), a mock scanner (SEC-083).
- MUST treat every FAIL as blocking closure until it is patched or recorded as DECISION NEEDED.
- MUST use only fake data (e.g. `@example.invalid` accounts) and the isolated local infra as evidence (SEC-064).
- MUST NOT rewrite, refactor or tidy code that passes (SEC-001).
- MUST NOT weaken a check to make it pass: no looser throttle, no wider allowlist, no skipped test, no scanner allowlist entry without a stated reason (SEC-108).
- MUST NOT print, quote or paste secret values in the review, the CHANGELOG or chat; check presence by count (SEC-070).

## Done checklist

- [ ] Scope lists endpoints, mutations, uploads, producers, jobs and log/audit boundaries, untracked files included.
- [ ] All 11 checks marked PASS/FAIL/N/A with `path:line` and rule evidence.
- [ ] Payment/event pass done, or N/A with a reason.
- [ ] Every FAIL patched with a test, or recorded as DECISION NEEDED.
- [ ] Shared build, typecheck, lint and tests green after the last fix; exit codes and counts recorded.
- [ ] i18n parity, both `pnpm audit` runs and secret-scan results recorded.
- [ ] CHANGELOG "Security close" section holds the table, "Fixed at closure" and "Residual risks".
- [ ] Commit proposed, not run.

## Pitfalls

- `git diff` ignores untracked files; new controllers, workers and specs hide there.
- An audit decorator without its interceptor records nothing (SEC-052). Check that rows actually appear.
- The soft-delete middleware filters top-level reads only; relations, includes, raw SQL and lock queries need explicit filters (ENG-076). With Prisma, a bypass whose lazy `PrismaPromise` is awaited outside its context silently does not apply (ENG-077).
- A reused outbox event key with `ON CONFLICT DO NOTHING` silently swallows the second effect (ENG-051).
- An idempotency receipt must key on method plus the concrete path including params, and hash body, query and user (ENG-016); otherwise a key replays across targets.
- Config read at import time runs before env loading and can fall back to a wildcard such as CORS `*` (SEC-068).
- CSP is enforced only in production, so a forgotten external host breaks only there (SEC-094).
- `pnpm -r --if-present lint` silently skips packages without a lint script; a green lint can be partial (QA-004).
