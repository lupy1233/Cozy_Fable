# App improvement execution plan

Date: 2026-09-16. Status: IN_PROGRESS; user requested remaining acceptance plus a deeper showroom visual refinement. Not certified release-ready.
Current phase: dedicated furniture visual refinement and automated compatibility/rendering checks complete. Final container packaging is blocked by Docker/WSL startup; physical-device and extensive manual acceptance remain open. P11 showcase draft awaits joint review. Owner: root coordinator.
This is the working checklist for the audit findings and the user's requested improvements. It extends the delivered sprints; it does not restart the original Sprint 0-9 sequence.

Implementation checkpoint: one-floor scope confirmed; additive migrations applied only to isolated test PostgreSQL. Showroom furniture, house editor, publication mapping, 48-concept artwork and summary adaptation are implemented. Latest pass: 553 regular tests, global typecheck/lint, 12 guest-browser tests; two authenticated browser cases skipped. Twenty final furniture captures inspected and all four software-render performance fixtures pass. The 17 separate PostgreSQL/MinIO tests and authenticated journeys passed before the current Docker outage, not in this visual pass. Evidence: `docs/implementation/verification.md`. Remaining unchecked items retain partial/manual acceptance boundaries in `docs/implementation/rollout-and-acceptance.md`; they are not silently declared complete. No production deployment, commit or git push.

Current blocker: Docker's WSL engine is unavailable after an externally initiated storage-location move failed; backend port 3001 is unreachable. C: now has about 7.9 GiB free at the latest check. User help requested: finish any intended storage move, dismiss Docker's Settings not applied dialog and restart Docker Desktop, then confirm engine running. No factory reset, WSL unregister, disk deletion or automatic global restart. The earlier Linux compilation passed but export was stopped below 2 GiB; current refined sources and slimmer runtime COPY still need a final serialized build and browser/PDF smoke. P10.01 remains unchecked.

2026-09-16 resumed scope: retain the one-floor/quotation contracts; improve materials, lighting, camera framing, soft furnishings and construction detail. Add missing reproducible resilience/compatibility checks. Investigate narrowly scoped runtime-image slimming to reduce packaging disk pressure; no broad cleanup or Docker-data relocation. Follow the original 2 GiB system-drive safety cutoff. See `docs/implementation/showroom-refinement.md` for this pass's evidence.

## Major changes at a glance

### What users will see

1. **Showroom furniture and a more complete catalog:** consistent materials, refined edges, lighting and proportions; bed first, followed by tables, benches and other verified gaps.
2. **A connected house layout:** arrange rooms together in a floor plan and combined 3D view, preserve shared door connections, save the layout and send it with the request to firms.
3. **Easier furniture and room editing:** clearer selection/dimension controls, move/rotate/snap feedback, keyboard/touch support and dependable undo/save behavior.
4. **Consistent answer illustrations:** extend the existing material/opening visual style across applicable questionnaire answers, including small inline choices and selectors.
5. **A redesigned project summary:** adapt Cozy-Mobilaunicat's compact facts and room cards, add the new furniture/house overview, retain expandable full details and clear edit/publish feedback.

### What will become more reliable

1. **Purchases and critical actions:** prevent duplicate business effects from retries; return the right saved result and recover queued work after failures.
2. **Accounts and live updates:** enforce session revocation, repair refresh/reconnect behavior and retain the intended multi-tab grace period.
3. **Uploads and private records:** validate stored file metadata, enforce attachment limits/states and apply tested soft-delete exclusion with appropriate historical exceptions.
4. **Builds, tests and performance:** refresh vulnerable dependencies, add frontend and production-build checks, improve accessibility/translations, pin infrastructure and measure 3D/loading costs.

After these changes pass acceptance: prepare the 30-60 second showcase concept, timed script and shot list for clients and furniture firms.

Planning review: this document defines work and completion evidence; it does not prove implementation behavior. House floor scope, publication limits and the mapping to quotation entries remain explicit design work below. The earlier contact-rule question has been resolved from approved project history.

## Confirmed scope

- Clean showroom 3D: refined proportions, softly rounded edges, restrained wood/fabric texture, consistent soft lighting. The generated bed comparison is a style reference, not an implemented renderer or performance promise.
- Improve furniture appearance first, add missing furniture beginning with the bed, then improve editing where existing controls need it.
- Connect multiple rooms into a house layout and preserve the resulting layout through saved drafts, requests and company viewing.
- Make answer illustrations match the existing material/opening illustrations throughout the questionnaire.
- Adapt and improve the summary from `F:/Cozy-Mobilaunicat`, preserving this application's behavior and data contracts.
- Resolve the verified audit issues, complete regression checks, then develop a 30-60 second showcase video concept for clients and furniture firms.

## Scope assumptions and decision register

These are planning boundaries, not newly established database fields or product rules. Only dependent implementation pauses when a genuinely unresolved product decision is reached; independent work continues.

| ID | Question / proposed boundary | State / required action |
|---|---|---|
| D01 | First house version: one floor, existing rectangular rooms, quarter-turn room rotation, aligned door connections. Multiple floors/stairs and arbitrary polygon walls are separate expansion. | CONFIRMED by user on 2026-09-15: one floor first with potential for multiple floors later. Keep the serialized model versioned and extensible; do not build stairs/multi-floor UI in this phase. |
| D02 | Mattress and bedding are visual context; quotation/scoring keeps the existing bed dimensions and storage choices. | RESOLVED in furniture-coverage.md. No extra mattress/bedding quotation entries are invented. |
| D03 | Contact-sharing history reconciled: supplied contacts are visible to firms with an occupying claim (ACTIVE/OFFER_SENT/COMPLETED); cancelled/withdrawn claims lose that access. | RESOLVED by approved `docs/archive/16-feedback-po-r6-sprints.md` W1, corroborated by CHANGELOG W1-W5 and current `quotes.service.ts`. Reconcile stale canonical documentation and retain API regression tests; do not reintroduce the superseded five-option selector. |
| D04 | Studio supports 12 scenes and 120 placements per scene; publication supports 12 scene snapshots but remains capped at 50 questionnaire entries and 300 KB total scene data. | RESOLVED. Capacity failures appear before transfer; never truncate. Opaque wizard state cap is 600 KB because answers and snapshots duplicate configuration. JSON parser cap is 1 MB. |
| D05 | Single-piece configuration, versioned house JSON, receipt checkpoints and durable event outbox are implemented. | RESOLVED in shared schemas, docs/04-data-model.md and docs/durable-event-contract.md. Three additive migrations applied only to isolated test databases. |
| D06 | Real antivirus beyond the current mock scanner. | Outside the current automatic fix scope. Metadata/state integrity is included; any service/provider addition is a separate decision. |
| D07 | Each physical placement remains one PIECE_* quotation entry; physical rooms group entries for display only. | RESOLVED: stable source scene/placement IDs map to persisted request-room IDs; repeat transfer updates existing entries. Real publication proves two separately placed nightstands remain two units. |

## Audit corrections and evidence boundaries

- Earlier lint/typecheck passed and 245 tests passed (132 backend + 113 shared). These are the previous audit baseline, not checks rerun during this planning turn.
- Earlier production build compiled and generated 75 pages, then failed on Windows standalone symlink permissions. Concurrent builds produced additional generated-file failures. Do not diagnose those as confirmed application defects. Only one build may use a given `.next` directory at a time.
- Earlier dependency audit reported 24 findings, including 2 critical and 7 high. Refresh advisories and lockfile evidence before selecting versions; counts and proposed patches are time-sensitive.
- Idempotency lookup followed by asynchronous receipt persistence is a verified gap. Existing domain locks protect some operations; do not claim all mutations necessarily duplicate. Purchase-order creation is a concrete test target.
- Refresh-token descendants within the documented 30-second grace period are intentional. Preserve grace and test revocation races; branching alone is not a defect.
- Hourly job reconciliation already exists. Extend its coverage and delivery guarantees rather than proposing it as a missing feature.
- Signed uploads already specify ContentType and ContentLength. Verify storage enforcement and actual HEAD metadata rather than assuming arbitrary bypass.
- Automatic soft-delete exclusion is absent, but many services already filter manually. Prove the remaining exposure paths and preserve intentional historical access.
- Current showroom model inventory: BOOKCASE, WARDROBE, TV_UNIT, SHOE_CABINET, DRESSER, NIGHTSTAND, DESK. BED, TABLE and BENCH are selectable questionnaire families without corresponding 3D kinds.
- The Prisma class `RequestRoomItem` maps to the actual table `request_items`; `request_room_items` was an incorrect name in the first plan and has been corrected.
- Physical studio scenes and request/quotation entries are not interchangeable. Inventory evidence: studio `sendToRequest`, shared `MAX_REQUEST_ROOMS`, Prisma `RequestRoom.quotePrices`. A quantity regression fixture must check that two individually placed nightstands do not inherit a per-entry default of two and become four requested units.

## Subagent management

Maximum active team: root plus three subagents. Assign bounded tasks and reuse slots as phases finish.

| Role | Ownership | Handoff |
|---|---|---|
| Root coordinator | Scope, decision log, task ledger, shared contracts, integration, final acceptance and changelog | Assign exact files and acceptance criteria; review every deliverable before marking complete. |
| Reliability agent | Auth, idempotency, uploads, durable workflow work | Reproduction, implementation, focused tests, affected tables, remaining risks. |
| 3D/layout agent | Geometry, materials, furniture editor, house geometry | Typed contract proposal first; visuals, edge cases, saved-data compatibility and performance evidence afterward. |
| Experience/verification agent | Initially CI/tests; then illustrations, accessibility and summary; finally independent regression | Coverage inventory, assets/UI, tests and visual evidence. Reassign infrastructure work here while UI depends on a contract. |

Planning research was delegated to `plan_reliability`, `plan_3d`, and `plan_summary_icons`; all returned findings without editing application files.

### Scheduling and file locks

- Wave A: P00/P01 baseline and harness; reliability design in parallel with 3D/illustration inventories. Capture performance budgets before visual implementation. Root may research P06 house coordinates/publication limits while the 3D agent prepares furniture work.
- Wave B: P02 backend fixes; P03-P05 visual/piece work. Once the P01 harness is ready, the experience agent completes P08.07 shared accessibility before the editor depends on it, then proceeds to artwork. Root integrates shared contracts.
- Wave C: finish P06 house contract, then P07 editor/publish. House geometry design needs stable piece bounds and serialization contracts, not completed table/bench artwork. The summary shell/adaptation may start after its source mapping; final furniture/house integration waits for those implementations.
- Wave D: P09 complete summary, P10 integrated QA, then P11 video concept.
- One owner at a time for `packages/shared`, migrations, `studio-store.ts`, `configurator-store.ts`, `step-renderer.tsx`, locale catalogs, package manifests and lockfile. Agent handoffs explicitly transfer ownership.
- Never run package installation or production builds concurrently in this shared checkout. A checker waits until writers finish. Use isolated checkouts only when needed and preserve unrelated user work.
- Every agent receives: task IDs, exact scope/files, dependencies, required checks, expected result format, and explicit stop conditions for conflicting requirements.
- Root checks results against actual diffs and tests, not an agent's completion claim alone. Reassign an independent reviewer after implementation; do not spawn a fourth child.
- Task states: TODO, IN_PROGRESS, BLOCKED with reason, READY_FOR_REVIEW, DONE with evidence. At most one phase is the primary integrated phase; independent tasks may proceed in parallel.
- Each task records `owner | files | dependencies | evidence | remaining risk` below its checklist entry when execution starts. Work does not count as DONE until integration passes.
- Waves describe eligible work, not additional agent slots: the experience agent handles CI, shared controls, artwork and summary sequentially unless a completed workstream frees another slot. Root publishes each handoff before another agent writes those files.
- Planning sizes below are relative: S = bounded change, M = several linked changes, L = a workstream needing subtask checkpoints. They are not elapsed-time promises. Re-estimate after baseline; keep a 25% integration/debugging allowance. Use 30-60 minute investigation checkpoints to avoid unbounded research.

## P00 — Baseline, inventories and contracts (S/M)

Modules: documentation, frontend/backend/shared inventories. Tables: none changed.
Assumptions: existing source and user changes are preserved; all previous results are dated baseline evidence.

- [x] P00.01 Record confirmed user scope and clean showroom style.
- [x] P00.02 Locate the source summary project and inspect current target/source components.
- [x] P00.03 Revalidate key audit claims and record corrections above.
- [x] P00.04 Capture current revision, worktree status, runtime versions and isolated test services; record a reproducible baseline without seeding or modifying production.
- [x] P00.05 Create furniture coverage matrix: question/flow -> create -> configure -> place -> preview -> save/reload -> publish -> company viewer. Include legacy versions and explicitly classify unsupported entries.
- [x] P00.06 Create answer-visual coverage manifest: room/piece, flow version, question ID, option value, renderer, current visual, replacement/intentional exception.
- [ ] P00.07 Capture desktop/mobile screenshots of current objects, room editor, material/opening cards and review. Record rendering, texture payload and route payload baselines on named devices. Before P03/P07 rollout, record numeric acceptance budgets for frame time, load/payload and memory using named small/large fixtures; choose budgets from measured device behavior rather than promising an untested frame rate.
- [x] P00.08 Create source-to-target summary adaptation map using the approved post-claim contact rule in D03. Register actual data-contract changes before implementation, including physical-room versus quotation-entry mapping.

Gate: every user request and audit item has a task ID; fixture inventory and unresolved dependencies are explicit.

## P01 — Reproducible checks and dependency baseline (M)

Owner: experience/verification agent. Dependencies: P00.04.
Modules: manifests/lockfile, `.github/workflows/ci.yml`, Dockerfiles, frontend test configuration, backend test teardown, deployment docs. Tables: test services only; no business schema changes expected.

- [x] P01.01 Refresh production dependency audit, record exact installed versions/advisories/reachability, then select compatible fixes for Next and other affected chains, including mail, uploads and image processing.
- [x] P01.02 Apply upgrades in compatibility groups, preserving the lockfile; avoid unrelated framework-major migrations.
- [x] P01.03 Add a clean Linux standalone/container build gate plus startup/static asset/health smoke checks. Diagnose the Windows symlink constraint separately.
- [x] P01.04 Add frontend component/integration tests and browser smoke infrastructure for the workflows changed in this plan; use dedicated local test accounts/data.
- [x] P01.05 Investigate Jest open handles once with diagnostic options; close the actual leaked resources and confirm natural exit.
- [x] P01.06 Replace deprecated `next lint` tooling and address Vitest CJS warnings in compatible, bounded changes.
- [x] P01.07 Pin infrastructure images; clearly separate local demo defaults from deployment secrets. Validate required production configuration and both Compose files.
- [x] P01.08 Add dependency-monitoring/audit policy; align stack/version docs, archive labels and one verified deployment procedure. Carry the already-approved D03 contact rule into the stale canonical references with a link to its decision history.

Gate: clean installation, shared/backend/frontend checks, Linux production packaging, test termination and fresh dependency disposition have recorded results. No unassessed critical finding is treated as release-ready.

## P02 — Correctness, sessions and workflow recovery (L)

Owner: reliability agent. Dependencies: P00; P01 test infrastructure as needed.
Modules: common/idempotency, auth, event-bus/gateway, uploads/storage, Prisma, claims/quotes/billing/Stripe, reconciliation, frontend API/socket and upload-consumer hooks.
Existing tables involved: `idempotency_keys`, `users`, `refresh_tokens`, `attachments`, `requests`, `claim_slots`, `quotes`, `quote_versions`, `mock_billing_orders`, `stripe_events`, `subscriptions`, `company_credit_wallets`, `credit_transactions`, `notifications`, `audit_logs`. Other PII tables are inventoried before filtering changes. New persistence/columns are TBD by reviewed technical design.

Pre-implementation contract gate for schema/session/delivery changes: specify existing-data handling, version compatibility and rollback before writing migration-dependent code. For sessions, define treatment of already-issued tokens and any required re-login. For durable delivery, specify replay ownership and consumer deduplication. Rehearse recovery with isolated fixtures before applying a migration to user data.

- [x] P02.01 Reproduce simultaneous same-key purchases and receipt-write failures against real PostgreSQL. Inventory every critical endpoint, including withdrawals, and frontend key lifetime across retries.
- [x] P02.02 Design and implement atomic request ownership, durable result replay and crash recovery. Include identity of user, concrete target, endpoint and request body; UUID v4, TTL, payload mismatch and original HTTP status must behave correctly.
- [x] P02.03 Test same key across different target IDs/users, parallel requests, expiry races, failure before commit and interruption after commit. Demonstrate one order/credit effect and consistent retry response.
- [x] P02.04 Bind REST and Socket.IO authorization to current session/block/deletion state using a reviewed mechanism. Revoke old private access after new-device login, logout, block or password reset.
- [x] P02.05 Coordinate frontend token refresh, disconnect/reconnect and listener cleanup; distinguish expired credentials from revoked sessions and avoid reconnect loops.
- [x] P02.06 Test parallel tabs within the 30-second grace period, reuse after grace, and refresh racing logout/block/new login. Fix demonstrated races while preserving approved grace semantics.
- [x] P02.07 Inventory post-commit queue/event effects and existing reconciliation. Implement durable delivery/recovery for uncovered effects with a concrete persistence design; preserve EventBus as the event path.
- [x] P02.08 Inject Redis failure before/after commit and during recovery. Verify one domain result, correct deadlines, eventual notifications and no duplicate credit settlement.
- [x] P02.09 Check HEAD object metadata against accepted upload declaration; cover nonexistent object, mismatch, storage failure, unauthorized completion and repeated completion. Enforce SAFE-only downloads.
- [x] P02.10 Reconcile and implement documented upload states/queued mock scan where required; preserve mock scope and label any actual spec conflict. Serialize attachment capacity checks; add DTO-level array caps matching shared contracts.
- [x] P02.11 Inventory soft-delete fields and privileged historical exceptions; implement automatic exclusion with nested-relation and admin/anonymization tests, preserving append-only audit behavior.
- [x] P02.12 Run concurrency, auth, uploads and business-regression checks; update invariant/contract documentation only to reflect validated implementation or explicit decisions.
- [x] P02.13 Complete frontend handling for queued scans before P02.10 ships: refresh scan status, show pending/blocked/error states, and handle retry/delete during scanning for request files, optional 3D snapshots, chat and quote uploads. Wait for SAFE before attachment relinking; retain the existing best-effort behavior for optional preview generation rather than blocking an otherwise valid request.
- [x] P02.14 Exercise existing Stripe and manual-transfer flows using test doubles/test-mode fixtures: timeout after Checkout creation, retry/resume checkout, repeated/out-of-order webhooks, admin/webhook confirmation race and interruption before session-ID persistence. Assert one order/subscription/credit effect, recoverable checkout and compatible `stripe_events` replay.

Gate: failing reproductions now pass; money/state effects remain singular for Stripe and manual confirmation; revoked sessions lose private access; recoverable failures preserve workflow and data integrity. Queued upload states are supported by every affected UI consumer before they are enabled.

## P03 — Shared showroom appearance (M/L)

Owner: 3D/layout agent. Dependencies: P00.05/P00.07, agreed shared render contract.
Modules: `components/configurator/piece3d/{piece-canvas,finishes,piece-viewer}.tsx/ts`, `components/studio/{room-canvas,previews,room-viewer}.tsx`, shared geometry helpers. Tables: none expected.

- [x] P03.01 Extract a shared furniture visual layer from the standalone and room renderers so every surface uses the same appearance.
- [x] P03.02 Implement one representative cabinet: correct proportions, soft edge treatment, coherent panel gaps, handles and feet using supported configuration.
- [x] P03.03 Add restrained wood/fabric treatment, matte surfaces, contact shadows, lighting and camera framing. Preserve distinction between requested construction material and visual finish.
- [x] P03.04 Apply the style to all seven existing 3D types; preserve custom colors, interior views and opening behavior.
- [ ] P03.05 Validate extreme sizes, UV/texture scale, outer dimensions/collision bounds, thumbnail legibility, memory/resource cleanup and mobile render cost against baseline. Automated bounds, 20 native visual captures, resource cleanup and mobile-emulation budgets passed on 2026-09-16; physical-phone render acceptance remains open.

Gate: same furniture matches across editor, room, preview and company viewer; dimensional meaning and existing configurations survive. Show user a small in-app before/after set; the chosen showroom direction needs no second approval.

## P04 — Bed end-to-end (L)

Owner: 3D/layout agent; root owns shared-contract integration. Dependencies: P03 foundation.
Modules: shared piece3d config/model, versioned guided bed flow, registry, studio palette/store, editor/viewers, summary conversion, translations. Existing persistence: `studio_drafts`, `request_studio_scenes`, `request_rooms`, `request_items` and request snapshot paths, inspected before writes.

- [x] P04.01 Inspect Cozy-Mobilaunicat bed implementation and license/provenance as reuse candidates. Compare its bed data with the target's existing mattress sizes, upholstery and storage choices.
- [x] P04.02 Define typed bed configuration reflecting existing 90/140/160/180 x 200 choices, upholstery and NONE/LIFT_UP/DRAWERS storage. Separate mattress size, external furniture footprint and existing scoring/quotation dimensions; a wider decorative frame must not silently change business scoring.
- [x] P04.03 Build showroom frame, headboard, mattress and restrained bedding; clarify visual-only elements without silently changing quote scope.
- [x] P04.04 Add bed to creation palette, appropriate edit controls, previews, placement, rotation, naming and RO/EN summaries. Do not show cabinet-only controls for a bed.
- [x] P04.05 Before enabling new configuration writes, define and test readers/migrations for existing local, account and published data. Version changed question flows, preserve original interpretation of historical flows and reject unsupported future versions without resetting saved work.
- [x] P04.06 Complete save/reload, login handoff, request conversion, publication and company viewing. Test all existing mattress/storage/upholstery combinations and invalid input.

Gate: a bed can be created, edited, placed, saved, reloaded and sent to a firm with correct dimensions/specifications; old drafts remain readable.

## P05 — Remaining furniture coverage (M/L)

Owner: 3D/layout agent. Dependencies: P00 inventory, P04 configuration pattern.
Modules/tables: same pipeline as P04; actual per-piece field changes declared before work.

- [x] P05.01 Integrate TABLE using its existing questionnaire choices across every column of the coverage matrix.
- [x] P05.02 Integrate BENCH with the same end-to-end completeness.
- [x] P05.03 Resolve each additional inventory gap as an existing-type mapping, concrete new-piece task, or explicitly documented unsupported scope. Never imply all furniture is covered while unresolved rows remain.
- [x] P05.04 Verify quantity semantics, duplicate placements, size limits, invalid configurations and reusable-library piece editing. Include two individually placed nightstands -> exactly two requested/quoted units; reconcile per-entry quantity defaults during studio conversion.
- [x] P05.05 Run full furniture fixture/contact sheet review across existing and new pieces.

Gate: every scoped furniture option has a working 3D path; exclusions are visible and reasoned rather than generic fallbacks.

## P06 — House layout contract and geometry (L)

Owner: root contract owner + 3D/layout agent. Dependencies: D01/D04 resolution for contract finalization; stable piece footprint/serialization contract from P04. Coordinate/connection research can begin after P00; completed P05 renderers are not a prerequisite. Whole-app acceptance still requires all scoped furniture.
Modules: `packages/shared/src/studio.schemas.ts`, studio/configurator stores, backend studio/requests DTO/services, geometry helpers. Existing JSON storage: `studio_drafts.data`, `request_studio_scenes.data`. No new table is assumed; decide aggregate versus per-scene snapshot representation before implementing.

- [x] P06.01 Finalize one-floor scope or adjust for user's answer. Define room/world coordinates, stable room identities, wall thickness/height and connections in a versioned contract.
- [x] P06.02 Keep furniture local to its room; compute combined world transforms. Define adjoining partial walls, shared wall ownership and aligned door openings without duplicated walls.
- [x] P06.03 Validate overlap, finite bounds, valid references, doorway fit, placement limits and room resize/delete/duplicate behavior. Reconcile D04 scene, placement, request-entry and serialized-byte limits; show capacity failures before transferring or publishing a house.
- [x] P06.04 Write deterministic readers/conversion for v1 local studio data, v2 local/account drafts and currently unversioned published scene snapshots. Legacy disconnected rooms remain usable; do not mutate historical request snapshots in place.
- [x] P06.05 Implement server validation and publication representation with round-trip fixtures, oversized-data rejection, ownership checks and safe failure behavior.
- [x] P06.06 Agree the summary/company-view data adapter before UI agents consume the new contract.
- [ ] P06.07 Test upgrade and rollback compatibility before enabling new-format writes: include v1->v2->new browser data, v2 account JSON, stale open tabs, interrupted conversion and refused downgrade without overwrite. Preserve recovery copies where conversion writes existing data; choose deployment order so older clients cannot corrupt new data. Any database change needs a tested recovery procedure. Keep generated previews separate from authoritative dimensions/configuration.
- [x] P06.08 Define stable source scene/placement -> request entry mapping, including initial transfer, repeated transfer, edits, deletions and duplicate placements. Preserve existing quotation units, scoring, quantities and attachment links while grouping entries under physical rooms for display. Validate quote totals and house/summary/company-view consistency with mixed-room fixtures.

Gate: two/three-room fixtures connect, move, rotate and serialize correctly; old drafts survive; no orphan links, duplicate walls or silent dropped rooms.

## P07 — House editor and better editing (L)

Owner: 3D/layout agent. Dependencies: P06 contract and persistence; P08.07 shared accessibility foundations, scheduled early. Artwork completion in P08 is not a prerequisite for editor implementation.
Modules: studio page/canvas/viewers/store, draft hooks, configurator transfer and company read-only views. Tables: P06 storage only unless concrete design changes require more.

- [x] P07.01 Add a floor-plan editor and whole-house 3D view with clear active-room selection.
- [x] P07.02 Add room move/rotation, numeric dimensions/position, snapping and visible connection/overlap feedback.
- [x] P07.03 Add or improve door-connection editing; ensure shared-wall edits update both sides and room movement handles existing connections predictably.
- [x] P07.04 Improve current object controls after observing existing selection/drag/resize/rotate/snap workflows. Retain useful existing undo/redo rather than rebuilding it unnecessarily.
- [x] P07.05 Group drags into one undo action, support keyboard/touch controls, and explain effects when changing a library piece used in multiple placements.
- [x] P07.06 Preserve autosave, account draft restore, login handoff and error recovery; avoid writing large snapshots on every pointer move.
- [x] P07.07 Transfer/update the house using P06.08's stable mapping, without duplicating entries or losing attachments. Preserve furniture quantities and existing quotation units; support read-only firm viewing, physical-room grouping and drill-down into dimensions.
- [x] P07.08 Verify a complete journey: add bed/cabinet, connect second room, adjust doorway, undo, save, reopen, publish, inspect as firm.

Gate: the full journey works on desktop and touch; no work loss, duplication or coordinate drift; unavailable WebGL has a useful fallback.

## P08 — Answer artwork, accessibility and localization (L)

Owner: experience agent. Dependencies: P00.06; coordinate shared files with P04-P07.
Modules: `public/illustrations`, `components/configurator/illustrations/**`, `playing-card`, `step-renderer`, `question-anchor`, selectors, UI dialogs/dropzone/tabs and locale catalogs. Tables: none expected; stored answer values unchanged.

- [x] P08.01 Use the 11 existing material/opening PNGs as the style anchor. Specify camera, crop, object scale, light, transparency and shadow in a reusable asset brief.
- [x] P08.02 Create a small representative set (bed, cabinet, layout choice, appliance, yes/no state); inspect at actual card/pill sizes before extending the collection.
- [x] P08.03 Produce/reuse optimized assets per distinct concept; retain provenance and meaningful filenames. Keep project assets in the workspace and avoid unrequested replacement of reference assets.
- [x] P08.04 Replace registry visuals and bypass paths: inline answer pills, booleans, target strips, room/piece selectors and conditional/legacy options.
- [x] P08.05 Review dimension diagrams, numbers, text/upload/free-form inputs separately. Preserve functional explanatory diagrams; record intentional exceptions in the coverage manifest.
- [x] P08.06 Add asset fallbacks, reserved space, loading strategy and contact-sheet coverage checks. Selected/recommended/error states remain distinguishable beyond color.
- [x] P08.07 Fix modal focus/Escape/restore, keyboard upload, tab keyboard/ARIA behavior, translated assistive names and comfortable touch targets in shared components and custom 3D dialogs.
- [x] P08.08 Verify mobile/desktop and RO/EN across every renderer; answer labels, flow IDs and historical interpretation stay stable.

Gate: every applicable answer option maps to a consistent, legible visual or a documented functional exception; no accidental generic furniture fallback remains.

## P09 — Improved summary from Cozy-Mobilaunicat (M/L)

Owner: experience agent; root reviews data adapter. Dependencies: P00.08; shell can start early, final bed/house integration waits for P04/P06/P07.
Source references: `F:/Cozy-Mobilaunicat/apps/frontend/src/components/configurator/{review-facts-card,review-room-card,review-step}.tsx`.
Target modules: `review-step`, `review-rail`, `room-answer-summary`, `attachment-item`, `configurator-wizard`, configurator store/request hooks, locale catalogs. Existing request-related tables only; no summary-specific schema assumed.

- [x] P09.01 Complete adaptation/provenance map. Reuse layout/interaction ideas and compatible components through the target's own contracts.
- [x] P09.02 Build compact project facts, per-room furniture summaries and expandable complete answers with edit-and-return navigation. Facts must account for budget/range or undisclosed state, estimated amount where applicable, deadline, project/design-help flags, location/country, description and provided contact channels. Preserve the distinction between estimated budget and a firm's actual quote.
- [x] P09.03 Integrate bed dimensions/storage and the house overview from agreed shared data, preserving quantities and per-room identity through P06.08's mapping; do not merge existing quoted entries merely to simplify presentation.
- [x] P09.04 Show sketches, snapshots, inspiration and uploaded files without duplicate attachments. Handle missing/loading/failed previews and optional/long values.
- [x] P09.05 Show completion blockers, focused validation errors, publish progress, network recovery and success state. Preserve authenticated publication and allowed published-request edit rules.
- [x] P09.06 Keep source anonymous submission, terms fields, `/multumim` redirect, `needsPaidDesign` and `bedConfig` assumptions out unless explicitly mapped to existing target behavior.
- [x] P09.07 Verify client-only review and firm-facing view separately under the existing approved D03 rule. Test access before claim, occupying claim, cancelled/withdrawn claim and another firm; private details must remain API-authorized and disappear when claim access ends.
- [ ] P09.08 Test new request, draft-to-login, existing edit, design help, mixed incomplete rooms, bed/house, legacy flow, undisclosed budget, failed uploads, offline/slow publish, RO/EN and mobile keyboard behavior.

Gate: users can understand and correct the entire request; expanded detail loses nothing; publication retains existing business and access rules.

## P10 — Integrated QA, performance and closure (M/L)

Owner: independent reviewer in a freed subagent slot; root integrates. Dependencies: all required P01-P09 work.
Modules: changed surfaces and adjacent critical journeys. Tables: isolated test fixtures only unless repairing a demonstrated defect.

- [ ] P10.01 Run focused unit/integration checks, full typecheck/lint/tests and one serialized production build in Linux/container context. Validate migration compatibility when relevant.
- [ ] P10.02 Browser-test client journey through configurator/house/review/publish and firm journey through visibility/claim/chat/quote/acceptance; verify old saved data and RO/EN.
- [ ] P10.03 Test keyboard, screen-reader semantics, touch, narrow widths, slow network, failed API/storage, refresh expiry, permissions and WebGL-unavailable paths.
- [ ] P10.04 Compare 3D frame time, memory/resource disposal, route loading and serialized locale payload to the named fixtures and numeric budgets recorded in P00.07; trim transferred messages and split touched monoliths only where evidence justifies it. Record actual results and device/browser limitations.
- [x] P10.05 Record representative before/after captures, performance/test evidence and remaining issues by severity. See showroom-refinement.md, performance/README.md and rollout-and-acceptance.md under docs/implementation. Critical/high unresolved correctness or security failures prevent release readiness; recording evidence is not release certification.
- [x] P10.06 Update CHANGELOG, acceptance evidence, source-of-truth docs and task states; review each changed area independently. Read/apply security-close and other relevant repo skills when closing actual implementation sprints.
- [x] P10.07 Prepare rollout/rollback notes and isolated demo data. Deployment or public publication is a separate action from this planning request.

Gate: every included item is DONE with evidence or explicitly deferred with reason and user-visible impact; never call an untested browser flow verified.

## P11 — 30-60 second showcase concept (S/M, after changes)

Owner: root with a script/storyboard subtask in a freed slot. Dependency: P10 demonstrable finished app.
Modules/tables: none. Deliverable: concept, script, timed shot list, captions/CTA and recording guide; video production/publication is not implied by a request to help think of it.

- [x] P11.01 Review what actually shipped and select a repeatable demo showing value to both clients and furniture firms.
- [x] P11.02 Draft a 45-second concept: 0-5s project need; 5-17s showroom furniture choices including bed; 17-27s connect rooms/house; 27-35s clear editable summary; 35-42s firm receives useful project details and prepares an offer; 42-45s client/firm call to action.
- [ ] P11.03 Offer a 30-second cut and a 60-second cut using the same genuine flow. Adjust shot durations after a timed read-through; avoid fabricated prices, adoption claims or capabilities. Draft cuts are delivered; recorded/timed read-through remains part of joint video review.
- [x] P11.04 Prepare voiceover/on-screen copy, capture order and demo fixtures without client PII. Choose language/aspect ratio for the intended channel when preparing the final script.
- [ ] P11.05 Review the concept together after the changes; provide a practical screen-recording/editing checklist for the chosen cut.

Gate: script fits 30-60 seconds, both audiences see concrete value, and every shown capability exists in the final app.

## Requirement-to-task traceability

| Requirement / audit observation | Coverage |
|---|---|
| Showroom appearance | P03 |
| Missing bed | P04 |
| Other missing pieces | P00.05, P05 |
| Easier editing | P07.02-P07.06 |
| United rooms/house layout | D01/D04, P06-P07, P09.03 |
| Saved-project compatibility and rollback | P04.05, P06.04/P06.07, P10.01 |
| Physical rooms, quoted units and quantity consistency | D04/D07, P04.02, P05.04, P06.08, P07.07, P09.03 |
| Consistent answer icons everywhere | P00.06, P08 |
| Reuse/improve source summary | P09 |
| Client + furniture firm video after changes | P11 |
| Idempotency concurrency/identity/status replay | P02.01-P02.03 |
| Old access token/session invalidation | P02.04-P02.06 |
| Refresh overlap and realtime reconnect | P02.05-P02.06; preserve intentional grace |
| Upload metadata/state/limits/DTO cap and frontend scan handling | P02.09-P02.10/P02.13 |
| Existing Stripe/manual payment retry and webhook integrity | P02.03/P02.14 |
| Post-commit queue/event failures | P02.07-P02.08 |
| Automatic soft-delete exclusion | P02.11 |
| Dependency advisories | P01.01-P01.02, P01.08 |
| Build reproducibility/CI scope | P01.03, P10.01 |
| Frontend test gap/Jest handles | P01.04-P01.05 |
| Dialog/dropzone/tabs/touch/i18n | P08.07-P08.08, P10.03 |
| Translation payload/large modules | P00.07, P03.01, P10.04 |
| Floating images/secret defaults | P01.07 |
| Next/tooling/deployment/archive drift | P01.06/P01.08, P10.06 |
| Approved contact rule and documentation reconciliation | D03 resolved, P01.08, P09.07 |

## Per-sprint close and continuity contract

Before each implementation sprint: declare phase/task IDs, module/file ownership, exact existing/new tables, assumptions, and dependencies. Read the applicable local skills and relevant invariant/business/data/decision sections. If a genuine source-of-truth conflict remains, label DECIZIE NECESARA and stop the affected implementation.

After each sprint: review diffs, run relevant tests, record manual/visual evidence, update this checklist and CHANGELOG, and prepare a checkpoint commit command. Commit/push/deploy actions follow the user's authorization for that execution phase.

Compaction/handoff must retain: current phase and active task IDs; completed tasks/evidence; changed files and user-owned unrelated changes; agent ownership/file locks; D01-D07 states and any new DECIZIE NECESARA; pending checks; next runnable task.

### Planning completion

- [x] User requirements, audit findings and audit corrections are retained.
- [x] Three specialist planning agents returned code-backed findings.
- [x] Dependencies, ownership, acceptance gates and unresolved choices are recorded.
- [x] Full checklist saved in repository documentation.
- [x] Second review checked product/data and reliability contracts; corrected table naming, approved contact history, house-to-quote mapping, quantity/limit tests, migration timing, scan consumers and Stripe regression scope.
- [x] Implementation evidence appended in `docs/implementation/`; unchecked acceptance boundaries remain explicit.
