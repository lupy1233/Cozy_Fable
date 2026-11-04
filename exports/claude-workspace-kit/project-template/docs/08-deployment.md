<!-- Source of truth: deployment, environments, runbooks, platform gotchas. Precedence: technical invariants (02) > decisions log (07) > business rules (03). Don't guess: mark DECISION NEEDED and stop. -->

# 10. Deployment and operations

*How <APP_NAME> gets from a tagged commit to a healthy production, and back. This doc describes the pipeline; it never authorizes a deploy: every deploy, promotion, rollback, production migration or production variable change needs the owner's explicit approval in the current session (OPS-001, OPS-002). Rule IDs refer to `docs/workspace-rules/09-release-and-operations.md` (OPS) and `06-security-baseline.md` (SEC).*

> **Template.** Fill this doc before the first deploy, and keep it in line with the real pipeline in the same change as any infrastructure change (SOT-045, MEM-013). Names only: never write a secret value, a password or a token here (SEC-070, MEM-030). Owner-only actions are written as numbered owner steps with exact commands (WM-008, PO-050). Delete the italic guidance once a section is filled; delete sections that do not apply (e.g. blue/green on a single-slot setup) and log the omission as a `D-R-<n>` entry in `07-decisions-log.md`.

## Current state (as of <YYYY-MM-DD>)

*Update this banner after every switch, promotion or infrastructure change, and label the values it replaces as historical in the gotchas log or the promotion record; never leave two "current" answers (OPS-102). If nothing has been deployed yet, write "Not deployed" and the date.*

| **Item** | **Current value** |
| --- | --- |
| Deploy status | `<DEPLOYED / NOT DEPLOYED — reason>` |
| Release tag / SHA | `<RELEASE_TAG_PATTERN>` / `<40-hex SHA>` (OPS-030) |
| Active slot / standby slot | `<SLOT_A>` / `<SLOT_B>` (or "single slot") |
| Deployment IDs | `<active deployment id>`, `<standby deployment id>` |
| Image digests | `<sha256:...>` |
| Public host | `<PUBLIC_HOST>` |
| Region | `<PROD_REGION>`, every service co-located (OPS-088) |
| Last backup / last restore test | `<date>` / `<date and result>` (OPS-079, OPS-082) |
| Open `DECISION NEEDED` items | `<IDs or "none">` |

## 10.1 Environments

*One row per environment. Write journeys (mutations, payments, email, migration rehearsals) run only in an isolated staging environment with its own data and captured email; the production standby is a read-only preview, and production secrets never go to staging (OPS-053, SEC-072).*

| **Environment** | **Purpose** | **Host / URL** | **Data** | **Email** | **Payments** | **Who may deploy** |
| --- | --- | --- | --- | --- | --- | --- |
| Local dev | Development and tests | `localhost` | seed scenarios (`06`) | mail catcher | not configured | anyone, locally |
| Staging | Write rehearsals, previews | `<STAGING_HOST>` | synthetic only | captured | provider test mode | `<who>` after approval |
| Production | Live users | `<PUBLIC_HOST>` | real | `<SMTP provider>` | `<live / manual>` | Claude only with the owner's explicit OK (OPS-001) |

## 10.2 Services and topology

*One row per service. State the topology in one line first: single slot with migrate-on-boot (OPS-039), or two slots behind a gateway (OPS-044). Platform deploy settings live as config-as-code and are confirmed in the live service metadata before the first traffic switch (OPS-028).*

Topology: `<single slot | blue/green: SLOT_A + SLOT_B behind GATEWAY>`.

| **Service** | **Role** | **Source / image** | **Health path** | **Config file** | **Notes** |
| --- | --- | --- | --- | --- | --- |
| `<APP_SERVICE>` / `<SLOT_A>` | App (frontend + backend) | `Dockerfile.<x>`, digest-pinned base (OPS-011) | `<HEALTH_PATH>` (OPS-068) | `<path>` | runs as non-root (OPS-015) |
| `<SLOT_B>` | Standby slot | same image | same | `<path>` | `DEPLOYMENT_MODE=standby` (OPS-045) |
| `<GATEWAY>` | Reverse proxy, owns the public host | `<image>` | `/health/live` | `<path>` | upstream in `ACTIVE_UPSTREAM` |
| `<DB_SERVICE>` | PostgreSQL `<version>` | managed | — | — | backups: 10.9 |
| `<CACHE_SERVICE>` | Redis (cache, queues, rate limits) | managed | — | — | password + `family: 0` on IPv6 networks (OPS-097) |
| `<STORAGE_SERVICE>` | Object storage | managed | — | — | private bucket, versioning (SEC-087) |
| `<BACKUP_SERVICE>` / `<RESTORE_TEST_SERVICE>` | Backup cron / monthly restore test | `<image>` | none | `<path>` | cron in UTC (OPS-086) |

## 10.3 Environment variables (names only)

*Every variable the services read, by name. Never a value. Secrets live only as platform service variables (OPS-025). A new or rotated variable is set on every slot before the release that needs it, without triggering a redeploy, and the previous release must boot with it present or absent (OPS-026). Build-time public variables need a rebuild of every slot, not a restart (OPS-019). Keep `.env.example` in line with this table (SEC-069).*

| **Variable** | **Service(s)** | **Required in prod?** | **Build-time?** | **Purpose** | **Set by** |
| --- | --- | --- | --- | --- | --- |
| `DEPLOYMENT_MODE` | slots | yes | no | `active` / `standby` (OPS-045) | release step |
| `RUN_MIGRATIONS` | slots | yes | no | `false` on both slots under blue/green (OPS-041) | release step |
| `RELEASE_SHA` | slots | yes | no | release identity reported by health (OPS-058) | release step |
| `ACTIVE_UPSTREAM` | gateway | yes | no | slot that receives traffic (OPS-044) | release step |
| `LISTEN_HOST`, `LOG_LEVEL` | slots | yes | no | loopback bind (OPS-020), log level (OPS-069) | setup |
| `<SECRET_NAME>` | `<service>` | `<yes/no>` | no | `<purpose>` | owner (PO-050) |
| `<NEXT_PUBLIC_*>` | slots | `<yes/no>` | **yes** | `<purpose>`; empty disables the integration | setup |

## 10.4 Build and release procedure

*The exact commands for this platform, in order. Placeholders follow chapter 09; on a platform other than the reference one, keep each step's intent. The `release-rollout` skill runs this procedure; a delivery that is not approved for deploy lists these steps under "Prod steps (after approval)" and runs none of them (OPS-003).*

1. Cut an annotated tag `<RELEASE_TAG_PATTERN>` on the full SHA from a clean, dedicated release worktree with a commit and a CHANGELOG entry (OPS-030, OPS-007).
2. Run the exact-SHA CI gate script: `<CI_GATE_COMMAND>` (OPS-031).
3. Security: the sprint security close has no open FAIL (SEC-001), and the pre-deploy security review of the release diff reports 0 HIGH / 0 MEDIUM (SEC-118).
4. Build the production image and run the isolated image smoke harness: `<IMAGE_SMOKE_COMMAND>` (OPS-012, OPS-013, OPS-024).
5. Confirm the linked service from the release worktree: `<PLATFORM_CLI> status` (OPS-101).
6. Deploy: `<DEPLOY_COMMAND>`, then poll `<DEPLOYMENT_LIST_COMMAND>` until a NEW deployment id succeeds (OPS-098, OPS-099).
7. Verify, record and update the current-state banner (10.6, 10.7, 10.12).

## 10.5 Migrations

*How schema changes reach production on this setup. Migrations are additive (expand/contract); DROP and RENAME wait for a later contract release (OPS-033). Every migration carries a `-- Rollback:` note and, for unique indexes or validated constraints, duplicate pre-check queries that must return 0 (OPS-034 to OPS-036).*

- Mode: `<migrate on boot with RUN_MIGRATIONS=true (single slot, OPS-039) | explicit serialized step before the app (blue/green, OPS-041)>`.
- Command: `<PLATFORM_CLI> run --service <DB_SERVICE> -- <migrate script>` with the switch to the public DB URL inside the child process (OPS-074, OPS-075).
- Before: a fresh backup through the backup job, and a rehearsal against a restored copy (OPS-041, OPS-054).
- After: `prisma migrate status` is clean; seeds and backfills run only now (OPS-040).
- CHECK constraints on populated tables: `NOT VALID` first, `VALIDATE` in a later release after a zero-violation query and a backup (OPS-037).

## 10.6 Promotion (blue/green or staging → production)

*Blue/green: the candidate goes to the inactive slot in standby, is verified, then promoted (OPS-052 to OPS-058). Single slot: replace this section with the staging → production promotion steps you actually use.*

1. Deploy the candidate to the inactive slot with `DEPLOYMENT_MODE=standby`, `RUN_MIGRATIONS=false` and its `RELEASE_SHA` (OPS-052).
2. Run the slot verifier: `<SLOT_VERIFY_COMMAND>` (wrong slot, mode or SHA fails; localized entry pages load; mutations get 503 `<STANDBY_ERROR_CODE>`). After a gateway change, also run the client-IP spoofing probe (SEC-023).
3. Record the checkpoint (OPS-054) in a new promotion record (10.12).
4. Move the active slot to standby and wait for its workers to drain; move the candidate to active; confirm one worker generation; switch `ACTIVE_UPSTREAM` (OPS-056, OPS-057).
5. Verify the public release identity: health reports `mode=active`, the expected slot and SHA, and DB, cache and storage up (OPS-058).

## 10.7 Smoke checklist (after every production deploy)

*Copy this list into the promotion record and tick it there (OPS-059). Use one dedicated synthetic account per role, and clean up afterwards.*

- [ ] Health dependencies up; static assets load; login, refresh and logout work; websocket connects
- [ ] A disposable write and its delete; an upload that passes scanning and downloads byte-for-byte equal; private-file access; a generated document
- [ ] Each primary journey of every role end to end, with the email each step sends; an ownership denial
- [ ] Affected routes return 200 and the live HTML carries the new UI markers; the canonical host sends no `X-Robots-Tag: noindex`
- [ ] Outbox backlog, failed queues, payment checkpoints, pending scans and logs back at baseline; no missing-config warnings
- [ ] Synthetic accounts disabled, their tokens revoked, synthetic objects deleted; smoke report kept

## 10.8 Rollback

*Prefer rolling forward with a fix (OPS-062). Never restore the database or down-convert users' data as part of an application rollback (OPS-063, OPS-064).*

- Triggers: a health dependency down, a wrong public release identity, any duplicated payment, notification or queue side effect, a failed smoke check, or error rate or latency materially above the recorded baseline `<BASELINE>` (OPS-065).
- Blue/green: the mirror of 10.6: stop new mutations, move the current slot to standby and drain it, confirm pending work is preserved, move the previous slot to active, switch the gateway back, keep the failed slot in standby for investigation (OPS-062).
- Single slot: redeploy the retained previous image by deployment ID and compare digests; avoid the platform's automatic rollback (OPS-066).
- Health-probe changes: before rolling back to a release that lacks a new health route, unset the probe variable (OPS-067).
- Compatibility windows still open: `<e.g. token-refresh grace period, persisted-format readers>` (OPS-055, OPS-057).

## 10.9 Backups and restore rehearsal

*Backups are proven only by a restore. Keep the "restore rehearsed" item unchecked until a real restore-test report arrives (OPS-082).*

- Schedule and retention: `<cron in UTC>`, at least 7 daily copies, applied only after a successful backup (OPS-079, OPS-081, OPS-086).
- Off-site storage mirror: `<rclone target>` with a 30-day backup dir (OPS-080).
- Restore test: monthly, separate service, newest backup older than `<MAX_BACKUP_AGE>` fails; OK/FAILED report to `<recipient>` (OPS-082).
- RPO `<derived from schedule>` · RTO `<target set by the owner; measured pg_restore duration + manual steps>` (OPS-084).
- Key escrow holders (names only) for the backup private key, at-rest encryption key, hashing salts and off-site credentials: `<holder 1>`, `<holder 2>` (SEC-078).
- Manual restore: only into a NEW database, verified against the manifest, behind the inactive slot in standby (OPS-083).
- [ ] Restore rehearsed (date, report reference): `<pending>`

## 10.10 Production data operations

*Only when the user explicitly asks. Every operation is a committed script behind a named package script, dry-run by default, with an explicit confirm variable, preceded by a backup, and run through the platform's run command so credentials never enter the agent's context (OPS-073, OPS-074, OPS-076). Demo seeds never run here (OPS-077).*

| **Date** | **Script** | **Asked by** | **Dry-run counts** | **Backup ID** | **Result (read-only verification)** |
| --- | --- | --- | --- | --- | --- |
| | | | | | |

## 10.11 Monitoring, alerts and owner-only steps

*Who is alerted, and how. Owner-only items are numbered steps the owner performs (PO-050).*

- Error tracker: `<project / DSN variable name>`; test-error triggers checked after setup (OPS-069).
- Uptime monitor on `/health/ready` every 1-5 minutes from `<PROD_REGION>`; alert recipient `<owner's choice>` (OPS-103).
- Logs: read per slot (`<log command>`); slow queries above `<SLOW_QUERY_MS>` are WARN lines (OPS-070).

Owner steps:

1. `<DNS / domain step>`
2. `<SMTP provider with SPF/DKIM/DMARC; DMARC starts at p=none>` (OPS-091, OPS-092)
3. `<repository security settings: secret scanning, push protection>` (SEC-107)
4. `<create the uptime monitor and pick the recipient>` (OPS-103)

## 10.12 Promotion records (newest first)

*One dated record per production release, or a link to it under `docs/implementation/`. A record grows by appending `Update <date>` sections; it is never rewritten (OPS-102).*

```markdown
### <YYYY-MM-DD> — <tag> (<40-hex SHA>)

- Identities: active `<slot>` / standby `<slot>`, deployment IDs `<ids>`, image digests `<digests>`
- Checkpoint (OPS-054): variable snapshot (names only), migration list, queue/outbox and pending-work counts, backup ID
- Migrations and restore evidence: <...>
- Tests and smoke (10.7): <results; anything UNVERIFIED with reason and who checks>
- Exact rollback steps: <...>
- Security close: secret handling, fail-closed checks, auth/ownership checks, SEC-118 result, no real customer data modified
- DECISION NEEDED: <items or "none">
```

## 10.13 Gotchas log ("do not rediscover")

*Every platform or deploy trap that cost time, so no session rediscovers it (SOT-045, MEM-013). Values that the current-state banner replaced are moved here marked historical. Generic platform traps already in chapter 09 (OPS-094 to OPS-100) only need a pointer.*

| **Date** | **Symptom** | **Cause** | **Fix / workaround** | **Rule** |
| --- | --- | --- | --- | --- |
| | | | | |
