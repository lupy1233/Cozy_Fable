# Implementation verification ledger

Started 2026-09-15 from commit `47b4e5b41241ae3026b474665ed057cb8a323b95`.
Pre-existing work: planning CHANGELOG edits, `docs/18-improvement-execution-plan.md`, untracked `.agents/` and `AGENTS.md`. These are preserved.

## Environment

Current 2026-09-16 override: Docker/WSL is unavailable after an external storage-move failure, and backend port 3001 refuses connections. The daemon/service observations below describe the earlier working checkpoint, not current health. Frontend guest rendering remains testable at port 3100.

- System Node 21.6.0 was below the supported toolchain. Commands for this implementation use bundled Node 24.19.0 without changing the system installation. Repository/CI baseline: Node 22.22.2 or newer.
- pnpm 9.12.3. Docker Desktop started; daemon 29.5.2.
- Backend environment inspected without exposing secrets: PostgreSQL points to localhost:5432/marketplace.
- Application tests must use the separate `cozy-implementation` Compose project and its own named volumes. Existing development volumes are not reset.

## Dependency baseline and changes

- Initial fresh production audit: 24 findings (2 critical, 7 high, 13 moderate, 2 low).
- After compatible updates: 1 moderate, 0 high/critical/low. Next 15.5.25, Nodemailer >=9.1.1 and constrained patched dependency chains; exact versions are in pnpm-lock.yaml.
- Fixed 2026-09-30 (E-admin-platform-56): [Nest SSE field injection, GHSA-36xv-jgw5-4q75](https://github.com/nestjs/nest/security/advisories/GHSA-36xv-jgw5-4q75) — backend moved to NestJS 11.2 / Express 5 (patched from 11.1.18); nodemailer 10.0.13 (GHSA-v53p-9fqp-m79j) and engine.io >=6.6.10 (GHSA-2gc4-cqfq-p2gv) fixed the two HIGH prod findings. `pnpm audit` (full and `--prod`) reports 0 findings; CI now blocks high/critical on both audits and scans the production image with Trivy.
- Primary patch references: [Next image optimization advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4), [Nodemailer releases](https://github.com/nodemailer/nodemailer/releases).
- Infrastructure image digests were resolved from the installed images before pinning; pinning is a reproducibility measure, not an image-vulnerability audit.

## Result records

No implementation phase is complete merely because its code exists. Append command, outcome, scope and remaining checks here as verification runs.

### Focused checks, 2026-09-15

- Reliability owner: 11 suites / 66 tests pass, including real PostgreSQL session/receipt/cap/soft-delete tests and isolated MinIO conditional copy/ETag enforcement. Full domain-producer conversion remained in progress at this checkpoint.
- `pnpm -F backend exec jest --runInBand studio-publication.spec.ts`: 6 pass. Local->persistent quotation mapping, stale/missing references, legacy snapshot, house consistency, limits/no silent truncation.
- `TEST_DATABASE_URL=<isolated local DB> pnpm -F backend exec jest --runInBand checkout-recovery.integration.spec.ts payments.service.spec.ts`: 22 pass (3 actual DB tests). Same-key simultaneous purchases produce one order; provider timeout reuses exact persisted parameters; admin/webhook confirmation grants credits once and stores the notification intent.
- Stripe service/payment unit suite: 23 pass before the subsequent expiration-race guard; rerun included the updated payment suite above.
- `pnpm -F backend exec tsc --noEmit`: pass at checkout integration checkpoint. Full final run still required after other owners finish.
- Frontend experience owner: four RO/EN desktop/mobile summary smoke cases passed across runs (cold-start timeout corrected), 11 initial component checks plus 4 furniture-summary cases. House owner reports shared house23/furniture47 plus prior geometry52/flow10, frontend transfer5 and focus2 tests pass.
- Root browser: initial desktop house load/reload passed with no page errors. Expanded mobile test passed whole-house WebGL, paired doorway width edits, undo and reload. One desktop attempt during concurrent HMR loaded empty initial store and failed canvas assertion; stable rerun and persistence investigation remain required. Screenshots in `screenshots/`; no real-device performance claim.
- Isolated DB now has migrations through `20260916012000_checkout_recovery`. Named demo seed created 22 users/8 companies/15 requests/16 claims/8 quotes/52 audit entries/30 notifications ONLY in the dedicated local DB. Existing production/dev volumes untouched.

### Checkout recovery contract

`mock_billing_orders.stripe_checkout_attempt` is nullable JSON containing an opaque attempt key and immutable provider parameters, written before the external call. Existing open Checkout sessions are resumed, complete sessions await confirmation, and expiration cannot cancel a replacement between checkpoint and ID persistence. Receipt checkpoints reference the existing order rather than creating another on retry. Unknown attempts beyond the safe provider deduplication window fail closed and require reconciliation; no claim of indefinite automatic provider recovery. Reference: [Stripe idempotency](https://docs.stripe.com/api/idempotent_requests), [Checkout session retrieval](https://docs.stripe.com/api/checkout/sessions/retrieve).

Checkpoint JSON is backend-only, may contain the already supplied payer email, and is never returned by order DTOs or logged. Keep database access restricted; migration rollback requires resolving/preserving outstanding attempts first. Schema additions are documented with migration rollback notes.

### Integrated checks, 2026-09-15

- Global `pnpm typecheck` and `pnpm lint`: pass after furniture/publication integration. Final post-review rerun follows remaining visual edits.
- Global `pnpm test`: pass, 185 shared + 29 frontend + 220 backend = 434 regular tests. Six explicitly gated real-service suites skip without their TEST environment. Fixed their construction so a skipped suite does not require a datasource.
- Real PostgreSQL/MinIO: six suites / 17 tests pass with `TEST_DATABASE_URL` set to the isolated local database, `TEST_S3_ENDPOINT=http://127.0.0.1:9000` and `NODE_OPTIONS=--experimental-vm-modules`. The flag is required by the current AWS SDK dynamic imports inside Jest, and is included in CI. `--detectOpenHandles` exited naturally; no forced exit was used.
- Three legacy engine fixtures were updated to distinguish current v3 BED/TABLE/BENCH flows from explicitly frozen v2 flows; an additional current-v3 custom-material regression was added. Old flow definitions were not changed to satisfy tests.
- Real REST acceptance (`apps/backend/scripts/house-acceptance.cjs`): account studio save/reload and foreign ownership denial; publication of two connected rooms into five persisted quotation entries; two nightstands have two total units; contacts hidden before claim, visible to occupying firm, denied to unrelated firm, hidden again after voluntary withdrawal. All five related outbox intents completed on their first attempt.
- Fresh production dependency audit: exit 0, one moderate finding, no high/critical findings. Reachability disposition remains above.
- Playwright desktop/mobile suite: six cases passed before final atlas crop refinement. Browser evidence and final visual pass are recorded separately in `browser-verification.md`.

### Final code-freeze regression

- `pnpm test` after audit/controller/logging/CORS and payment fixes: **454 regular tests pass** (185 shared, 29 frontend, 240 backend). Seventeen real-service tests are intentionally gated out of this command, not counted as passes here; their separate six-suite run passed. No forced process exit.
- Manual-confirmation regression plus actual database checkout/confirmation suite: **37 pass**, including five new checks that a known Stripe checkout is closed before manual confirmation, provider failure refuses the action, unresolved outcomes refuse it and a changed checkout is detected under lock.
- Global typecheck/lint passed after the payment and final visual changes. The subsequent logging/controller owner also ran backend typecheck/scoped lint successfully; the production image compiles the frozen application again on Linux.
- Full real-service offer journey: chat authorization, five per-entry prices totaling synthetic RON 10,000, quote and acceptance result replay, winner-only delivery, client completion and duplicate-completion rejection. All eleven related outbox events completed on first attempt. Synthetic prices are test data, not advertised estimates.
- Root reviewed fresh house/RO-mobile-summary and artwork screenshots; visual findings were fixed before freeze. See `browser-verification.md` for exact browser versus REST coverage.
- Real desktop browser login/account-draft test passed: Studio sign-in now returns to Studio, preserving bed/house; account save, temporary doorway edit and account reload restore the saved geometry. Default-family visual inventory independently captured all ten actual WebGL furniture types with zero page errors.
- `git -c core.whitespace=cr-at-eol diff --check`: pass. Locale files retain their pre-existing CRLF format; default Git whitespace diagnostics otherwise flag those line endings.

### Packaging pause / handoff

- Final frozen source passed Linux shared/Prisma/backend/frontend compilation, lint/typecheck and all 75 routes. Image export was stopped below the 2 GiB C: free-space safety threshold; final production-browser/PDF smoke has not run. Initial-image runtime smoke remains valid only for that earlier image.
- Exact superseded task cache records were reclaimed, approximately 3.25 GB within Docker. This is rebuildable output, not application or user data; no broad cache/image/volume cleanup was used. Windows free-space headroom remained about 1.9 GiB.
- User help required before resuming packaging: free approximately 8-10 GB on C:. Local development preview and test data remain available. Remaining manual/release acceptance stays explicitly unchecked in the master plan.
- Handoff preview health caveat: the development process remained running, but final command-line `/en/studio` probes timed out at 15-25 seconds while development compilation was active. Earlier browser journeys passed; recheck preview responsiveness after restoring disk headroom before claiming the handoff preview is healthy.

### Showroom refinement freeze — 2026-09-16

- Regular regression: **553 pass** = 218 shared + 240 backend + 95 frontend. Shared/backend passed in this pass; frontend was rerun after the final renderer and geometry-only test mocks. Global `pnpm typecheck` and `pnpm lint` pass. The 17 gated real-service tests were not rerun during the Docker outage; their earlier passing result is historical.
- Final isolated-guest Playwright: **12 pass, 2 authenticated cases explicitly skipped**. Compatibility/storage/WebGL/320px/keyboard/failed-publish regressions are detailed in `browser-verification.md`; APIs are intercepted, not evidence of current backend health.
- Twenty final native furniture captures inspected, zero page/shader errors. Repeated editor finish/dimension changes and reopen yield a stable 8-texture/61-buffer plateau. All 478 allocated buffers deleted per context, five of nine textures explicitly deleted, remaining renderer allocations released by context loss. No duplicate-Three warning in the targeted browser route.
- All four named SwiftShader fixtures pass unchanged budgets: p95 33.3/83.4 ms desktop small/large and 33.4/83.3 ms mobile emulation; 31/255 draw calls. Detailed editor retains full quality; overview geometry is cheaper without removing components. Larger geometry/buffer cost versus the original baseline remains documented, not described as a universal speedup.
- Final Dockerfile packaging assertions and browser/PDF smoke remain unexecuted. At the latest read-only check C: had about 7.9 GiB free, but Docker's failed storage move/WSL recovery now prevents builds. Do not reset Docker data or restart unrelated services automatically. No deployment, commit or push.
