# Rollout and remaining acceptance

This document does not authorize deployment. Work remains local, uncommitted and unpushed. The existing production service and data have not been changed.

## Local review

Current handoff (2026-09-16): frontend guest Studio rendering works at port 3100, but Docker/WSL and the backend are unavailable after an external storage-move failure. Account/publication/firm flows cannot currently be reviewed live. Earlier authenticated evidence below is historical. Do not interpret the surviving guest preview as full app health.

Start the existing frontend/backend with the repository-supported Node runtime, using an isolated database and storage. The current development preview is `http://127.0.0.1:3100/en/studio` (Romanian: `/ro/studio`). Do not run two builds against the same `.next` directory. Linux packaging evidence is in `container-verification.md`; browser and real-service evidence is in `browser-verification.md`.

Use `house-demo-fixture.json` only in an isolated browser profile/test context; never overwrite the user's existing local Studio data to load a demonstration. The retained named account draft from the live journey is another review option.

## Release sequence — after approval

1. Back up PostgreSQL, especially `studio_drafts`, `request_studio_scenes`, pending orders, idempotency receipts and notifications. Record the current image/commit and export relevant pending-work counts without PII. Confirm restoration in a separate database. Do not run demo seeds against production.
2. Apply the three additive migrations through `20260916012000_checkout_recovery` before deploying the matching application. Existing notification event/email fields and checkout checkpoints remain nullable; historical rows are not replayed as new messages.
3. Deploy backend and frontend together and restart all workers. Do not operate mixed old/new mutation workers: old code does not write the new durable intents. Old access tokens lacking the session-family identity will be rejected; normal refresh may recover the session, otherwise users must sign in again. Preserve the documented 30-second refresh grace period.
4. Verify health dependencies, static assets, login/refresh/logout, a disposable draft write, SAFE-file access, a synthetic house publication and firm ownership. In Stripe test mode verify Checkout resume, failed/late provider responses and signed webhooks before enabling live purchasing. Confirm real SMTP and fiscal seller settings; the local Mailpit override is never a real-mail setup.
5. Inspect domain-event backlog, failed queues, payment checkpoints, upload scans and logs. Manually review representative desktop and physical-phone house interaction before general release. Use the captured fixture and provisional performance budgets; do not infer hardware FPS from SwiftShader emulation.

## Recovery / rollback

- Stop new mutations/old workers before a rollback. Keep the additive schema, pending outbox rows and checkout checkpoints; an older binary may run against extra columns but cannot understand or safely recreate new pending work. Prefer rolling forward with a fix.
- Browser Studio uses `mm_studio_v3`; its historical `mm_studio_v1` copy remains intact. Unsupported future/corrupt data blocks automatic overwrite. New account writes require the current schema, so an old v2 client cannot overwrite a v3 house through the new backend. Historical published snapshots are normalized only on read, not rewritten in place.
- Restoring an older frontend does not make newly created BED/TABLE/BENCH or house JSON readable by that frontend. Preserve a database backup and recover/export these projects with the new reader. Do not down-convert, reset or delete a user's new-format work to make an old client boot.
- Unknown Stripe outcomes must be reconciled with the provider using the existing order/attempt; never issue a new attempt key blindly. After the safe deduplication window, the app fails closed. Manual confirmation/cancellation refuses an unresolved attempt and closes a known payable session first.
- SMTP is at-least-once: a crash after SMTP acceptance but before its marker can resend an email. In-app notification identity is deduplicated. Do not promise exactly-once email.
- The isolated container-smoke harness cleans only its own test project. The separate development preview/demo database remains available. Never use broad volume cleanup to reset this work.

## Acceptance still requiring explicit attention

| Area | Current evidence | Remaining boundary |
|---|---|---|
| Visual direction | Implemented showroom style; 48 artwork concepts reviewed at 160/80/36 px; desktop/mobile screenshots | User's in-app visual review; not a second style decision |
| Saved work and login | Pure legacy readers, future-version overwrite refusal, account save/reload, transfer/repeat-transfer and ownership tests; real browser login returns to Studio and reload reverses a temporary doorway edit | Exhaustive interruption and old-tab/version combinations remain manual regression cases |
| Performance | Two/12-room fixtures, buffer disposal and software-render budgets; production asset sizes recorded separately | Physical phone/GPU, thermal/touch and real-device 30 FPS acceptance; no original pre-redesign performance capture exists |
| Accessibility / journeys | Keyboard component tests, dialog focus tests, RO/EN mobile/desktop browser smoke, real authenticated REST journey | Screen-reader session, Safari/Firefox, full click-through of every answer branch and offline/slow-network combination |
| Security/services | Regression tests, explicit SAFE metadata/sealing, session and ownership checks, durable intents | Scanner remains a mock; live Stripe/SMTP provider rehearsal, historical append-only audit remediation decision, private orphaned sealed-file cleanup |
| Video | 45-second storyboard plus 30/60-second cuts and recording checklist | Joint script/branding/channel review, timed voice recording, filming/editing/publication |

These boundaries are not marked as completed tests. None requires inventing business rules. The implementation can be reviewed locally while release acceptance remains open.

## Remaining issues by severity — 2026-09-16

| Priority | Remaining item | User impact / next step |
|---|---|---|
| Release blocker | Docker/WSL recovery and final refined-image build, migration/browser/PDF smoke | Backend currently unavailable; current Dockerfile packaging unverified. User finishes storage work/dismisses error and restarts Docker Desktop; verify engine before scoped builds. Never factory-reset or delete data. |
| High acceptance gap | Full authenticated client/firm browser journey and operational database restore rehearsal | Earlier real REST and login/draft tests passed, but not every step as browser clicks or against the final image. Preserve backups/additive schema and run these checks before release. This is an evidence gap, not a demonstrated data-loss defect. |
| Medium acceptance gap | Physical phone/GPU/touch, screen reader, Safari/Firefox and remaining questionnaire/upload/offline branches | Chromium desktop/mobile emulation, keyboard/reflow, storage/WebGL/failure paths pass. Real-device usability and all branch combinations are not certified. |
| Medium follow-up | Final production payload/locale comparison and separately scoped provider/security operations | Software scene budgets pass; richer geometry increases buffer cost. Reassess final production payload; retain documented mock-scanner, live-provider and historical-log limitations. Do not silently change providers or audit history. |
| Review | User visual walkthrough and 30/45/60-second video cut | All 20 final native furniture captures inspected; script/cuts drafted. Timed voiceover and joint concept/channel approval remain. No filming/publication implied. |

Evidence: original native gallery `screenshots/furniture-gallery`, final galleries `screenshots/showroom-refinement-defaults` and `screenshots/showroom-refinement-variants`, performance reports and the verification ledger. Final automated status: 553 regular tests and 12 browser checks passed, 2 gated authenticated cases skipped. No newly observed critical/high application defect remains open from the rendering pass; that is not a substitute for the release gates above.

## Review and optional checkpoint

No critical product decision is blocking the implemented one-floor scope. Before production, historical log access/retention and any credential remediation require an explicit operational decision; do not modify append-only audit history or rotate external secrets automatically.

Review the changed files before staging. Existing `.agents/` and `AGENTS.md` were already present and are not part of an automatic blanket add. Suggested checkpoint after review (not executed):

```powershell
git diff
git add -p
# Stage the reviewed new implementation files explicitly as well; -p does not add untracked files.
git commit -m "feat: showroom furniture and one-floor house layout with reliability hardening"
```
