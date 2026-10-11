---
name: release-rollout
description: Use this skill when the owner explicitly asks to deploy, release, promote, roll back or change production configuration ("deploy", "release", "lanseaza", "pune pe prod", "promoveaza", "rollback", "variabila noua pe prod", "set a new prod secret"), or when writing a "Prod steps (after approval)" list. Handles single-service deploys and active/standby (blue/green) slots behind a gateway, covering consent, readiness gates, secrets, migrations, promotion, post-deploy verification, rollback and the release record.
---

# Release rollout

Moves one reviewed, tagged commit into production and proves it is healthy, or moves production back. The output is either a recorded `DEPLOYED` release (deployment ids, tag, SHA, smoke results) or a `NOT DEPLOYED` status with the exact commands still to run (OPS-001, PO-009). Rule IDs in parentheses refer to the workspace rule chapters. Commands use `<PLATFORM_CLI>` with Railway-shaped flags and the default Docker + Prisma + Next.js stack; on another platform or stack, keep each step's intent and map the mechanism (chapter 09 intro).

## When to use

- The owner asks, in this session, to deploy, release, promote a candidate, roll back, or add or rotate a production variable.
- When writing a delivery's "Prod steps (after approval)" section (OPS-003): list the steps of this procedure in execution order, and run none of them.
- Not for: local migrations (OPS-010); write rehearsals, which belong in isolated staging (OPS-053); production data fixes or backfills (`seed-scenarios` skill, PROD RUN mode, only on a separate explicit ask, OPS-073); demo seeding, which never runs in production (OPS-077).

## Read first

- `<DEPLOYMENT_DOC>` (e.g. `docs/08-deployment.md`): topology, service names, `<PROD_REGION>`, health paths, the current active slot, the smoke checklist, rollback triggers, RPO/RTO and the "do not rediscover" gotcha list.
- `<RUNBOOK>`, when kept apart from the deployment doc: promotion and rollback steps and the last promotion record.
- `docs/02-technical-invariants.md` and `docs/07-decisions-log.md`: compatibility constraints the release must keep.
- The release's CHANGELOG entry and its "Security close" section, plus every migration's `-- Rollback:` note and duplicate pre-check queries (OPS-034, OPS-036).
- `<MEMORY_DIR>/MEMORY.md` and the deploy memory note: last deployed SHA, active slot, retained rollback image (MEM-013).
- Rule chapters 09 (release and operations), 06 (security), 05 (quality gates) and 10 (environment gotchas).

## Procedure

1. **Consent.** Quote the owner's approval for this specific deploy, promotion, rollback or variable change, given in this session (OPS-001, WM-021). A runbook, a plan, a security PASS or an earlier approval is not consent (OPS-002, SEC-002). Without it, stop: mark the work `NOT DEPLOYED — awaiting owner OK` and list the exact commands, in execution order, under "Prod steps (after approval)" (OPS-003, PO-009). Run platform commands yourself; a subagent prompt carries the deploy ban and never a runnable deploy command (OPS-005).
2. **Readiness gates.** Every gate must hold before any platform command:
   - `security-close` has run on the release diff, and every FAIL is patched or recorded as `DECISION NEEDED` (SEC-001). The pre-deploy security review of the full release diff reports 0 HIGH and 0 MEDIUM findings (SEC-118). Dependency audits and the image CVE scan are clean, or each advisory has a recorded disposition and fixed version; scanner exceptions carry a statement and an expiry at most 90 days out (SEC-100, SEC-102, SEC-104).
   - The local gates have run in CI order (shared build, typecheck, lint, tests), and their counts are recorded faithfully (QA-002, QA-010, QA-075).
   - An annotated tag `<RELEASE_TAG_PATTERN>` points at the full SHA. It was cut from a clean, dedicated release worktree with a commit and a CHANGELOG entry, never from the live working tree, which stays untouched (OPS-030, OPS-007).
   - The CI deploy-gate script confirms a green run on that exact 40-hex SHA from a push, tag or manual dispatch; a PR run does not count (OPS-031).
   - The production image was built and smoke-tested in an isolated harness: startup, static assets, health, one real write, and register → email → verify → login → `/me` (OPS-024, QA-098, QA-099). Base images are digest-pinned (OPS-011), the image runs as a non-root user (OPS-015), and every new runtime directory is copied into the final stage (OPS-018).
   - Platform deploy settings (health-check path, startup timeout, overlap, drain, restart policy) are config-as-code and confirmed in the live service metadata before the first traffic switch (OPS-028).
   - Every production service (app slots, gateway, DB, cache, storage, backup jobs) is in `<PROD_REGION>` (OPS-088).
3. **Link check.** Work only from the dedicated release worktree (on Windows, from PowerShell). Run `<PLATFORM_CLI> status` and confirm the linked project, environment and service. Never deploy from the main checkout or from an unlinked directory (OPS-101, OPS-098).
4. **Config and secrets** (only when the release needs a new or rotated variable). Secrets live only as platform service variables (OPS-025).
   - Generate the value locally and set it on EVERY slot in one shell line, so it is never printed, without triggering a redeploy, e.g. `$v = openssl rand -hex 32; <PLATFORM_CLI> variables --service <SLOT_A> --set "NAME=$v" --skip-deploys; <PLATFORM_CLI> variables --service <SLOT_B> --set "NAME=$v" --skip-deploys` (OPS-026, SEC-070).
   - Set it before you deploy the release that reads it, then redeploy standby first, verify, then active (OPS-026). The previous release must boot with the variable present or absent. Decide deliberately whether it is required, so no optional fallback hides a missing key (OPS-026, SEC-065).
   - Verify presence with a count (`... | grep -c NAME`), never by printing values (SEC-070). If the permission check refuses the read, do not rephrase the command; ask the owner to confirm in the dashboard (OPS-100).
   - A build-time public variable (e.g. Next.js `NEXT_PUBLIC_*`) needs a rebuild of every slot; a restart is not enough (OPS-019).
   - A key whose loss makes data unreadable (at-rest encryption key, backup private key) is escrowed by the owner in two independent copies before it is used; record only the holders' names (SEC-078).
5. **Data safety.** Take a fresh backup (dump + SHA-256) through the scheduled backup job, not a manual dump on a PC, and confirm it restores into a separate database (OPS-054, OPS-041). Classify rollback compatibility: any change to the schema, workers or queues, auth/session semantics, idempotency, provider side effects or persisted JSON needs a backward-reader test; without one, the release is roll-forward only (OPS-055). Before any unique index or constraint validation, run the migration's duplicate pre-checks; each must return 0 (OPS-036).
6. **Migrations.** Ship only additive (expand/contract) migrations; DROP and RENAME wait for a later contract release (OPS-033). Single slot: the boot applies them (e.g. `prisma migrate deploy` gated by `RUN_MIGRATIONS=true`) (OPS-039). Blue/green: keep `RUN_MIGRATIONS=false` on both slots; after a rehearsal against a restored copy, apply the migrations once, as an explicit serialized step before the app, through `<PLATFORM_CLI> run --service <DB_SERVICE>` with the switch to the public DB URL inside the child process, then check the migration status (e.g. `prisma migrate status`) (OPS-041, OPS-074, OPS-075). Run seeds and backfills only after the migrations (OPS-040).
7. **Deploy a single service.** Run `<PLATFORM_CLI> up --service <APP_SERVICE> --detach` from the linked worktree (OPS-099). Poll `<PLATFORM_CLI> deployment list --service <APP_SERVICE>` until a NEW deployment id reaches SUCCESS; while it builds, `status` keeps showing the old deployment as Online (OPS-098).
8. **Deploy blue/green** (OPS-052, OPS-056):
   1. On the inactive slot, set `RELEASE_SHA=<40-hex>` without triggering a redeploy, then deploy it with `DEPLOYMENT_MODE=standby` and `RUN_MIGRATIONS=false`. Poll as in step 7.
   2. Run the slot-verification tool against the slot URL with the expected slot, mode `standby` and SHA, through `<PLATFORM_CLI> run --service <inactive>` so the health token comes from env, never as an argument (SEC-076). It must fail on a wrong slot, mode or SHA, load the localized entry pages, and see mutations refused with 503 `<STANDBY_ERROR_CODE>` (OPS-052, OPS-045). After any gateway change, also run the client-IP spoofing probe (SEC-023).
   3. Record a checkpoint: deployment ids, image digests, SHAs, a variable snapshot (names only, never values), the migration list, queue/outbox and pending-work counts (no PII) and the backup id (OPS-054).
   4. Move the active slot to standby. Wait until its instance stops, its workers drain and blocking queue connections reach zero; writes get a brief 503 meanwhile.
   5. Move the candidate to active. Confirm exactly one worker generation and no duplicate notifications (OPS-046, OPS-057).
   6. Switch the gateway upstream (`ACTIVE_UPSTREAM`) to the candidate (OPS-044).
   7. Keep the previous slot in standby as the rollback target.
9. **Verify on the public host** (OPS-058, OPS-059):
   - `curl -s https://<PUBLIC_HOST>/<HEALTH_PATH>` returns a status-only body. With the token injected from env, the health details show `mode=active`, the expected slot and SHA, and DB, cache and storage up (SEC-076, OPS-068).
   - The per-slot logs (`<PLATFORM_CLI> logs --service <slot> --lines 200`) show migrations applied or disabled as intended, and no missing-config warnings (OPS-059, OPS-070).
   - Affected routes return 200, the live HTML carries the new UI markers (`curl -s https://<PUBLIC_HOST>/<route> | grep -c "<MARKER>"`), and `curl -sI https://<PUBLIC_HOST>/ | grep -i x-robots-tag` prints nothing (OPS-059, SEC-092, OPS-019).
   - Run a synthetic smoke with one account per role that cleans up its own data: register → the email arrives → verify → login sets cookies → `/me` (QA-099); refresh; websocket; a disposable write, then its delete; an upload that reaches the safe scan state, then its private download (SEC-080); a generated document; each primary journey of every role end to end, with the email each step sends; an ownership denial; logout (OPS-059).
   - The outbox backlog, failed queues, payment checkpoints and pending scans are back at baseline, with no duplicate notifications or emails (OPS-059, OPS-065).
10. **Roll back** when a trigger fires: a health dependency is down, the public release identity is wrong, a side effect is duplicated, a smoke check fails, or error rate or latency materially exceeds the recorded baseline (OPS-065). Prefer rolling forward with a fix (OPS-062). Otherwise mirror step 8: stop new mutations, move the current slot to standby and drain it, confirm pending work is preserved (payment attempts, outbox leases, notification jobs, upload scans), move the previous slot to active with one worker generation, switch the gateway back, and keep the failed slot in standby for investigation (OPS-062). For a single service, redeploy the retained previous image by deployment id and compare digests; avoid the platform's automatic rollback, which can also restore old variables (OPS-066). Before rolling back to a release that lacks a new health route, unset the probe variable (OPS-067).
11. **Record.** Write the dated promotion record (OPS-102): date, tag, 40-hex SHA, deployment ids, image digests, active and standby slots, migrations applied, restore evidence, smoke results, the exact rollback steps, the security close with the SEC-118 result, a `DECISION NEEDED:` line (even "none"), and anything left `UNVERIFIED` with its reason and who checks it (WM-031, SOT-045). Update the dated current-state banner at the top of `<DEPLOYMENT_DOC>` and mark older values historical. New platform gotchas go into the deployment doc's "do not rediscover" list. Update the CHANGELOG entry and the deploy memory note, which links to the doc rather than copying it, with either `DEPLOYED` plus the deployment id or `NOT DEPLOYED` plus the reason (MEM-001, MEM-013). If an outward action happened by accident, verify its impact read-only, report it as an INCIDENT (target, time, observed effect, how to undo) and record it in memory (OPS-006, MEM-009).

## Rules

- MUST have this session's explicit owner approval for every deploy, promotion, rollback, production migration or production variable change. One approval covers one action (OPS-001, WM-021).
- MUST deploy only the exact 40-hex SHA of a tagged, CI-green commit, from a clean release worktree. A build that reports `sha=unknown` is never promoted (OPS-030, OPS-031).
- MUST set new variables on all slots, without triggering a redeploy, before the release that reads them (OPS-026).
- MUST keep exactly one active slot and one worker generation. The standby slot registers no workers, runs no migrations and refuses mutations (OPS-045, OPS-047).
- MUST confirm a deploy by a new deployment id in the deployment list plus the public health identity, never by `status` or gateway health alone (OPS-058, OPS-098).
- MUST NOT print, echo or paste a secret value, or pass a token as a CLI argument (SEC-070, SEC-076).
- MUST NOT put a runnable deploy command in a subagent prompt (OPS-005).
- MUST NOT restore or down-convert the database as part of an app rollback (OPS-063, OPS-064).
- MUST NOT run demo or sample seeds against production (OPS-077, SEC-074).
- MUST NOT delete cloud services or projects; report stray ones to the owner (OPS-008).
- MUST NOT rephrase, split or re-issue a command the permission classifier refused; report the refusal and ask (OPS-100).
- MUST NOT point the public gateway at an isolated preview, or copy production secrets into staging (OPS-053, SEC-072).

## Done checklist

- [ ] The approval for this exact action is quoted from this session, or the status is `NOT DEPLOYED` with the exact commands in execution order.
- [ ] Security close has no open FAIL, the local gates and the CI run on the exact SHA are green, and the tag and clean worktree are recorded.
- [ ] The image smoke passed, the deploy settings are confirmed live, and region co-location is confirmed.
- [ ] Every new variable is on every slot, and its presence was verified by count without printing its value.
- [ ] A fresh backup with checksum restores, rollback compatibility is classified, migrations were applied once, and the migration status is clean.
- [ ] A new deployment id reached SUCCESS. For blue/green: the slot verifier passed, the checkpoint is recorded, there is one worker generation, and the gateway is switched.
- [ ] Public health is status-only and reports the right identity, the logs are clean, the UI markers are live, and there is no noindex header.
- [ ] The synthetic smoke passed and its data was removed; queues and outbox are at baseline with no duplicates.
- [ ] The deployment doc, CHANGELOG and memory hold the ids, tag, SHA, results and every `UNVERIFIED` item.

## Pitfalls

- Run from an unlinked directory, `<PLATFORM_CLI> up` silently creates a stray project; run from a directory linked to another service, it deploys there, possibly onto the gateway. On Railway from Git Bash inside a worktree it fails with "prefix not found"; use PowerShell (OPS-098, OPS-101).
- `<PLATFORM_CLI> run` executes locally with the service's variables injected, so it cannot reach private-network hosts. Switch to the public DB URL inside the child process (OPS-075).
- Gateway health does not check the mode: an upstream pointed at a standby slot passes health while every write returns 503 (OPS-058). Webhooks are POSTs, so a standby slot answers them with 503 as well (OPS-048).
- Default stack: on Debian slim without `openssl` installed before `prisma generate` in every stage, Prisma picks the wrong engine and crashes at runtime (OPS-017). A missing Next.js `public/` directory fails the final COPY (OPS-018).
- An empty or slot-specific site URL at build time can break the build or ship `noindex` to production (OPS-019).
- Railway injects its own `PORT`; set it explicitly, or the domain returns 502 (OPS-094). Private DNS takes about a minute after a redeploy, and transient timeouts in that window heal on their own (OPS-096).
- A database in another region adds cross-region latency (~150 ms) to every query and can push interactive transactions past their timeout (OPS-088).
- Never blindly retry an uncertain smoke write; clean up through the real API (QA-064).
- Commit and tag messages that contain backticks belong in a file passed with `-F` (ENV-011).
