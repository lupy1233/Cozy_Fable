# Production promotion — 2026-09-16

## Released version

Production remains at **https://backend-production-2813.up.railway.app**. The `backend` Railway service now runs the Caddy front door, forwarding to `app-green.railway.internal:3000`. The existing `gateway` alias continues forwarding through `backend`, so there is one authoritative traffic selector: `backend.ACTIVE_UPSTREAM`.

| Role | Service ID | Deployment | Identity |
|---|---|---|---|
| Active Green | `fb876d1b-7c65-46ee-8734-33a11f90128d` (`app-green`) | `dd0e6fe4-856f-4802-9121-974dc16d91fa` | SHA `0b6815f94c051f52ab683bc20973088e56ed3ed4` |
| Compatible Blue standby | `32e07ce9-b413-42ca-823a-3341f1f57766` (`app-blue`) | `891ef07c-596e-4045-93c6-9562250ace0e` | Exact previous tested Green image from `6ec40898-081a-44fa-9fb1-22db8993e503` |
| Production front door | `467d47dd-6ed6-46d9-b88e-e92a13a01129` (`backend`) | `4959d3bd-520b-4eba-a2f5-1794d67d28a4` | Caddy gateway |

Green image: `sha256:d22fd07dc1dfd2eef7147e0a7652c9574002b6b5938797313ee11df20fdfffdf`. Blue image: `sha256:4f900a234d0e33af2bfe09c2c8d393f385335ecce3dd5c8d0372cec06b71e5b6`. Front door image: `sha256:51f2169987532254f27888b8f95d33bd8d7726466d19bd6400889694ca05ac04`.

Immutable source checkpoint: local branch `codex/release-20260916-green`, annotated tag `release/2026-09-16-green`, clean worktree `F:\Cozy-Fable-releases\20260916-green`. The existing working tree and index were preserved; no Git remote push was performed. The candidate was rebuilt from this clean checkout with the production canonical URL, then activated using the same verified image digest.

Direct Green: https://app-green-production-1223.up.railway.app. The former Green URL, https://app-green-production-7958.up.railway.app, now belongs to **Blue standby** and rejects writes. Both slots now use production PostgreSQL, Redis, storage and authentication secrets. They are not isolated test environments. The separate preview dependencies remain available for future development; no preview records were copied to production.

## Migration and rollback compatibility

The old production image `720549d5-233d-4917-8d85-dc356db0aead` predated standby, Studio v3, durable outbox and the current schema. It cannot safely serve as an unrestricted rollback after new writes. Its source and production configuration were archived for recovery; it was stopped and is not a rollback traffic target.

Blue instead retains the previous fully tested Green build, before room snapping. Its backend matches the active release exactly: all 153 backend JavaScript files produce hash `4fa11435b5596756c3c06fce0377b2c9ad4e2d73137188b429e504e2e224bc01`; normalized Prisma schema hash is `9c00892635697b51c66758878a9c763bda769917d01e2f670e145d41ce9e5f85` on both slots. A newly saved production house was read through Blue and compared exactly, including rooms, transforms and furniture. Blue rejects mutations with `503 DEPLOYMENT_STANDBY`. Its original source SHA is unknown, so its retained image digest is the release identity; no SHA was invented.

Production originally had 28 migrations. All ten pending migrations were rehearsed against a restored copy and then applied once to production (38 total). Most are additive. `20260823200000_cleanup_dead_settings` removes exactly two obsolete setting rows, retained in the pre-upgrade backup. Existing wallets had no negative balance/reserved values. No demo or inspiration seed was run; the existing 70 published photographs were preserved.

Protected checkpoint directory: `F:\Cozy Fable\test-results\production-promotion-20260916`. It is ignored by Git/Docker and restricted to the current Windows user. Railway variable snapshots and synthetic test credentials are DPAPI-protected. The custom PostgreSQL dump and old source archive have verified SHA-256 checksums:

- `cozy-preproduction-20260916.dump`: `3f921a4c3f70affeb19c169cf78fe4da4aaa8be098148fd5699d516275a6d993`.
- `cozy-old-production-source-20260916.tgz`: `feef660678581d24871fa3a5fe84d4c750f87b2e6e105c63ec33471be12227f2`.

Restore rehearsal used a separate database, `cozy_release_rehearsal_20260916`. After migration it retained 31 users, 89 requests, the existing Studio draft, 34 attachments, 72 notifications and the append-only audit trigger. The current reader accepted the saved draft. The rehearsal database was removed after verification; backups remain protected.

## Handoff and verification

- [x] Production app health/drain settings explicitly configured; candidate metadata confirms `/api/v1/health`, 300-second startup timeout, zero overlap, 60-second drain.
- [x] Candidate first ran `green/standby` against production dependencies; RO/EN pages and mutation refusal passed.
- [x] Existing hostname preserved by replacing its service with the front door; no domain deletion/recreation or DNS ownership transfer.
- [x] Old production deployment and instance reached REMOVED before activation. Redis blocking worker connections reached zero before Green started; afterward exactly one worker host was present.
- [x] Public health reports `green/active` and the immutable SHA. DB, Redis and storage are healthy. Canonical URL remains the public production hostname.
- [x] 282 backend tests passed (17 integration cases intentionally skipped without their isolated fixture services). Previous candidate gates include 279 shared and 184 frontend tests.
- [x] All 10 production Playwright cases passed, desktop/mobile: snapping, overlap rejection, cancel, undo/redo, Full walls/Cutaway persistence, panels, fullscreen and canvas preservation. Config: `apps/frontend/playwright.production-ui.config.ts`; artifacts: `apps/frontend/test-results/production-studio-ui/`.
- [x] Real synthetic CLIENT login, refresh, Studio house save/read, backup read compatibility, unpublished request draft, 68-byte PNG upload/SAFE/download byte equality, WebSocket connection, logout and revocation passed.
- [x] Synthetic Studio draft and uploaded object removed; synthetic request discarded through its API. It was never published or sent to companies. Synthetic account is disabled after verification; its soft-deleted request/audit history remains for traceability.
- [x] Chromium produced a valid 17,230-byte PDF. This verifies production PDF runtime, without creating or altering a customer quote/invoice.
- [x] No pending or failed outbox intents after activation. No duplicate worker generation.

Smoke report: `smoke-84926e89-35d1-4df7-8f2a-1969f0165413-report.json` in the protected checkpoint. Upload SAFE verifies the existing queue/storage/mock-scanner workflow; it does not claim malware detection.

Final cleanup disabled and soft-deleted the exact synthetic account and revoked any remaining refresh tokens. It has zero remaining Studio drafts, active requests or live refresh tokens. There are 31 active users and 70 published photographs. Final public and direct-slot health checks passed: Green active at the expected SHA and Blue standby.

## Coordinated rollback to compatible Blue

Use only the retained compatible Blue above, not the archived old production binary. Verify service identities, latest successful image digests, matching production dependencies and current modes before every switch. Do not restore the database during application rollback.

1. Set Green `DEPLOYMENT_MODE=standby` with `RUN_MIGRATIONS=false`, and redeploy its current image. Wait for `green/standby`, the former active instance to stop, and zero blocking worker connections. Public reads remain available; writes pause.
2. Set Blue `DEPLOYMENT_MODE=active`, retain `RUN_MIGRATIONS=false`, and redeploy its retained image. Verify exact Blue image digest, dependency health, one worker host, login and saved-house reading.
3. Change **`backend.ACTIVE_UPSTREAM`** to `app-blue.railway.internal:3000` and redeploy the front door. The separate `gateway` alias follows it automatically. Verify public health reports `blue/active`.
4. Keep Green as standby for investigation. Reversal uses the same order: deactivate/drain Blue, activate/verify Green, route `backend` to `app-green.railway.internal:3000`.

Railway `deploymentRedeploy(id, usePreviousImageTag:true)` was used with digest comparison. Avoid an automatic platform rollback that also restores historical preview variables. The original Hobby removed-image retention is not the backup strategy: compatible Blue remains deployed, and Green has an immutable source checkpoint.

A full public reverse switch was not performed during this release. Compatibility, standby protection and the worker handoff were verified without deliberately replacing the newly released UI again.

## Security close

PASS: existing production secrets were preserved in memory and protected checkpoint storage; none were written to source or console. Standby fails closed, the single worker generation was checked live, and existing ownership/auth checks passed with an isolated synthetic account. No customer requests, messages, payments or quote data were modified by acceptance tests. The public hostname/cookie scope, production storage and existing email/payment configuration remain unchanged. DECIZIE NECESARA: none.

## Update 2026-09-17: hotfix publish (P2028) promovat pe Blue

- Cauza incidentului si fixul: vezi CHANGELOG "Hotfix: publicarea cererii cadea…" si nota din docs/08. Sloturile app + gateway sunt in EU West, bazele de date in alta regiune (~150 ms/query) — de aliniat (plan: docs/implementation/eu-region-migration-plan.md).
- Candidat: commit `d64437387c57c4396ce7451834a1c215a52fb9d9` (tag `release/2026-09-17-publish-fix`), deployat pe `app-blue` in standby (deployment `b1d0ef6d-1420-44a3-a651-9bd8b3b559de`), `verify-slot.mjs` PASS (blue/standby/sha, RO/EN 200), POST → 503 DEPLOYMENT_STANDBY.
- Switch (ordinea din runbook): `app-green` → standby (deployment `d12358a0-bd17-4fbd-a8c1-46b340786e11`, 21:11 EEST) → `app-blue` → active (`ec4432e1-a69f-4341-91ab-ca4bf28d7367`, reconciliere re-inarmata: slaBreach 6) → `backend.ACTIVE_UPSTREAM=app-blue.railway.internal:3000` (`95cc4e72-c293-42fb-a2f0-74819652141a`, 21:14 EEST). Scrierile au fost oprite ~3 minute (21:11:44 → 21:14:40).
- Verificare publica: health `blue/active/d644373…`, pagina RO 200, draft anonim creat (201) si aruncat (200) prin domeniul public; fara erori in logurile `app-blue`.
- Rollback compatibil: `app-green` standby cu `0b6815f9…` (fara schimbari de schema/cozi intre cele doua release-uri).
- Incident colateral: `railway up` rulat dintr-un worktree nelinkat a creat proiectul Railway strain **`responsible-harmony`** (`7a3c1dc2-c0b8-4369-bfc0-bf0510f2022f`) cu un build pornit; de sters manual (`railway delete -p 7a3c1dc2-c0b8-4369-bfc0-bf0510f2022f -y` sau din dashboard). Lectie: `railway link -p <proiect> -e production -s <serviciu>` in fiecare worktree nou INAINTE de `railway up`; `railway up` din Git Bash intr-un worktree pica cu "prefix not found" — ruleaza din PowerShell fara argument de cale.
