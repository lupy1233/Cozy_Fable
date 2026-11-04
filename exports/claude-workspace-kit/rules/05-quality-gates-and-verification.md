# Quality gates & verification

This chapter defines how work is proven done: the typecheck, lint and test gates, tests against a real database behind a host guard, CI, browser checks of UI changes, acceptance checklists and performance measurement. The security close lives in chapter 06, and the release and operations checks live in chapter 09.
To adapt it to another project, map the commands to your package manager and workspace layout, fill in the `<PLACEHOLDERS>`, and keep the strength tags as they are. A rule tagged `MUST` stays a hard gate.

## Core gates and their order

- **QA-001** `MUST` Expose the repo-wide gate commands `pnpm typecheck`, `pnpm lint` and `pnpm test` as root scripts (`pnpm -r --if-present typecheck`, `pnpm -r --if-present lint`, `pnpm -r --if-present test`), and give every package its own `typecheck: tsc --noEmit` script.
- **QA-002** `MUST` Gate every change with these commands, run in this order: build the shared package, then typecheck all packages, then lint everything, then run the tests (backend Jest, frontend and shared Vitest). All of them must be green before acceptance. After any fix made during closure, re-run the whole sequence. — _why:_ the consuming apps are typechecked against the built shared package.
- **QA-003** `MUST` Every work package ends with `pnpm typecheck`, `pnpm lint` and the specs it touched. The verifier then runs the full backend suite and the frontend tests. Record the suite and test counts for each touched package in the changelog or delivery note.
- **QA-004** `GOTCHA` Give every workspace (frontend, backend, shared) its own ESLint config and `lint` script, because `pnpm -r --if-present lint` silently skips any package that has none. — _why:_ a green lint result can hide the fact that whole packages were never linted.
- **QA-005** `MUST` The frontend package defines these scripts: `lint` runs eslint with `--max-warnings 0`, `typecheck` runs `tsc --noEmit` (strict mode, with the `@/*` alias), `test` runs `vitest run`, and `test:e2e` runs `playwright test`. All of them must pass before work is closed.
- **QA-006** `SHOULD` Keep `strict: true` in every tsconfig. Consider adding `noUnusedLocals` and `noUnusedParameters`, which together with backend lint catch dead code.
- **QA-007** `SHOULD` Backend ESLint enforces correctness, not style. Use `eslint:recommended` plus `@typescript-eslint/recommended`, make unused variables an error with a `^_` ignore pattern, and allow `any` in legacy specs but treat it as an error in the typed test harness. Lint covers both `src` and the ORM and seed scripts (e.g. `prisma/`).
- **QA-008** `SHOULD` Enforce design tokens with ESLint `no-restricted-syntax`. Ban arbitrary pixel font sizes (`text-[NNpx]`) and non-canonical surface classes, and have the error message point to `<DESIGN_TOKENS_DOC>`. Don't start the names of custom typography utility classes with `h-` or `text-`. — _why:_ tailwind-merge mistakes such names for height and color utilities.
- **QA-009** `SHOULD` Production code meets a hygiene baseline: zero `console.*`, `debugger`, `@ts-ignore`, TODO/FIXME, production `any` and commented-out code. Long comment blocks are allowed only for documented decisions. Track files over ~800 lines and every disabled `react-hooks/exhaustive-deps` as candidates for refactoring and stale-closure bugs. Periodically remove orphan files, dead exports, dead locale keys, error codes that are never thrown and unused dependencies, using import-graph scripts and identifier greps to find them.
- **QA-010** `MUST` Local gates equal the CI gates (QA-036) minus the dependency audit and Playwright, which run only in CI.

## Test architecture

- **QA-013** `MUST` Unit specs (`*.spec.ts`, colocated in `src`) test services with Prisma, Redis, S3 and queues mocked. Add minimal e2e tests for each endpoint that cover the happy path and at least one edge case.
- **QA-014** `MUST` Add `*.integration.spec.ts` tests against a real PostgreSQL whenever a change touches transactions, idempotency, soft delete or uploads.
- **QA-015** `MUST` Prioritize tests for critical logic: concurrency locks, idempotency replay, time-based workers, payment webhooks and their signature checks, access guards, token rotation and reuse detection, and entity lifecycle transitions. Every audit lists the critical paths that are still untested.
- **QA-016** `MUST` Transition tests cover each new state and the race in which the conditional update returns `count === 0`.
- **QA-017** `MUST` Test deadline logic with fake timers or time travel. Include a test where the state changed between scheduling and trigger.
- **QA-018** `SHOULD` Unit specs freeze time with modern fake timers but keep `nextTick`, `setImmediate` and `queueMicrotask` real. Integration specs run on real time and test time rules by back-dating columns. — _why:_ mocked promises must still resolve, and the database's `now()` cannot be faked.
- **QA-019** `SHOULD` Unit-test pure business helpers (balance arithmetic, upload validation, notification routing, business calendar), including end-of-day deadlines in `<BUSINESS_TZ>` at millisecond precision, and cover pure domain logic in the shared package (ENG-104) with unit tests, especially where the visual result cannot be checked in the browser tool. — _why:_ these tests caught a timezone offset that lost milliseconds and pushed end-of-day deadlines to 00:00:00.997 on the next day.
- **QA-021** `SHOULD` Keep the transaction helper a free function rather than a method on the ORM service, so unit mocks such as `$transaction: jest.fn((fn) => fn(tx))` keep working. Build services in tests through typed factories that call constructors in the real parameter order (typecheck enforces this), and stub only the edges (queues, event bus, calendar, storage). — _why:_ a positional constructor call once silently passed one dependency in another dependency's position.
- **QA-022** `SHOULD` Test just under and just over every size or count limit, and keep the frontend and backend limit constants in sync. When a limit applies per logical group, compute the global cap as per-group limit × number of groups + a buffer.
- **QA-023** `SHOULD` Run frontend unit and component tests with Vitest, jsdom and Testing Library, as colocated `src/**/*.test.ts(x)` files. Use a setup file that mocks `matchMedia` and `ResizeObserver`, and alias the shared package to its source.
- **QA-024** `SHOULD` When a behavior change is intended, update the existing assertion that encoded the old behavior in the same sprint (invert it) instead of deleting the test.
- **QA-025** `MUST NOT` When an assertion fails, first work out whether the app or the test is wrong. If the app behaves correctly, fix only the test and record why. Never change frozen or legacy definitions or the acceptance fixture just to make a test pass.

## Real-database tests and the host guard

- **QA-026** `MUST` Gate real-service integration specs behind explicit env vars, one per real service (e.g. `TEST_DATABASE_URL`, `TEST_S3_ENDPOINT`, `TEST_REDIS_HOST`), so they skip cleanly when the vars are absent. Build each suite so that a skipped suite never needs a datasource. — _why:_ the regular test command stays runnable anywhere, while the real-DB suite stays opt-in.
- **QA-027** `MUST` Guard the test database URL in Jest `globalSetup` and in every integration spec. Before connecting, refuse any host other than `localhost`, `127.0.0.1`, `::1`/`[::1]` or `<CI_DB_SERVICE_HOST>`. The guard has no env override, and its error names only the host, never credentials. Exclude the test harness from the build tsconfig. — _why:_ integration tests create and delete data, so they must never reach a hosted database.
- **QA-028** `MUST` Run real-database and storage tests against an isolated Docker Compose project (`-p <TEST_COMPOSE_PROJECT>`) with its own named volumes and database. Never reset or reuse the developer's existing volumes, and seed test data only into that dedicated database. — _why:_ this keeps test runs from destroying local or shared data.
- **QA-030** `SHOULD` Integration fixtures create their own rows with a recognizable label prefix and `@example.invalid` emails, and delete them by id in `afterEach`. They change balances and state only through the real services and never touch demo or seed data. Each suite asserts domain invariants (e.g. the ledger stays balanced) and that no rows are left over.
- **QA-031** `MUST NOT` Do not force Jest to exit. Use `--detectOpenHandles` to check that real-service suites exit on their own. — _why:_ a forced exit hides leaked connections and handles.
- **QA-032** `MUST` Prove concurrency and money fixes against a real PostgreSQL. Cover these cases:
  - parallel requests with the same key
  - the same idempotency key used for different targets or users
  - expiry races, including expiry of completed receipts
  - rollback before commit, failure after commit (e.g. the idempotency receipt or response write fails) and interruption after commit
  - the last remaining unit of a capped resource
  - concurrent payment confirmations grant the purchased benefit exactly once, and the side-effect intent survives a cache outage
  - repeated or out-of-order webhooks
  - cache or queue failures injected before and after commit

  Assert exactly one business effect and a consistent response on retry. — _why:_ mocked transactions cannot prove locking or idempotency.
- **QA-033** `MUST` Prove races with real concurrent calls through `Promise.allSettled`. Assert invariants (counts, exactly one settlement, a balanced ledger) and never which caller wins. Repeat each race for several iterations and run with `--runInBand`, since parallel suites interfere with each other on one database. To reproduce production timing, widen the race windows by injecting per-query latency through a test-only Prisma middleware, and count the round-trips inside the transaction.
- **QA-034** `SHOULD` Set per-folder coverage thresholds on the critical domain folders and treat them as a ratchet. After each sprint, measure unit coverage, round down and subtract 2 points. A threshold never goes below its previous baseline and only ever goes up. Exclude specs, fixtures, `main.ts`, module wiring files and DTOs from coverage. To prove the gate works, check that a deliberately high threshold makes the run exit non-zero.

## Continuous integration

- **QA-035** `MUST` A CI workflow (e.g. GitHub Actions) runs the QA-036 job on every push and PR.
- **QA-036** `MUST` Run CI as one serialized verify job, in this order:
  1. published-text content gate (no leftover template placeholders, SEC-114)
  2. secret scan
  3. frozen-lockfile install
  4. Prisma generate
  5. shared-package build
  6. typecheck
  7. lint
  8. unit tests with coverage
  9. tests of the release tooling scripts (CI deploy gate, slot verifier, secret scanner)
  10. migrations and integration tests against real infrastructure
  11. dependency audits
  12. browser e2e on desktop and mobile
  13. production image build
  14. image CVE scan
  15. artifact-presence check

  Release-gate scripts are code and have their own tests in CI. — _why:_ every gate is enforced on every push and PR, not only when someone remembers to run it.
- **QA-037** `SHOULD` In CI, start the isolated infra with `docker compose up -d --wait`, run `prisma migrate deploy` against the fresh database, then run the integration specs serially with `jest --runInBand --ci --testPathPattern=integration.spec.ts`. — _why:_ this proves the migrations apply cleanly and tests concurrency against a real PostgreSQL instead of mocks.
- **QA-038** `SHOULD` Upload `coverage-summary.json` and lcov as a CI artifact in an `if: always()` step. Upload browser test results only `if: failure()`, and tear down the CI infrastructure in an `if: always()` step.
- **QA-039** `SHOULD` Configure Playwright as follows:
  - desktop and mobile device projects
  - a single worker, without full parallelism
  - traces kept on failure, screenshots only on failure
  - `forbidOnly` and one retry on CI
  - a `webServer` that runs the dev server on a dedicated port at `127.0.0.1`
- **QA-041** `GOTCHA` Branch protection and rulesets on a private GitHub repo need a paid plan. Without one, the exact-SHA CI gate script that runs before every deploy is the release gate (OPS-031). Track CI minutes against the plan's free monthly allowance, since a full serialized run can take the better part of an hour.

## Verifying against the running stack

- **QA-042** `SHOULD` After a backend edit with the dev server in watch mode, poll its background log in a bounded loop until you see the boot marker (e.g. `successfully started`) or a failure signature (`error TS`, `Nest can't resolve`, `UnknownDependencies`). Only then call the API. — _why:_ testing before the restart finishes produces false results against the old build.
- **QA-043** `SHOULD` Smoke-test the running stack with curl. Check the health endpoint's status code (with `--max-time`), a nonexistent route returning the standard error envelope and a 404, the frontend root redirecting to the default locale, and a locale route returning 200.
- **QA-044** `SHOULD` Test auth flows end to end with curl cookie jars and throwaway `@example.com` accounts. Cover login, refresh-token rotation, rejection of a replayed old refresh cookie, two independent parallel sessions, and the 2FA setup endpoint.
- **QA-045** `MUST` A verifier checks every "done when" item against the running local stack, either by logging in with curl and a cookie jar to call the API or by reading the database via `docker exec <DB_CONTAINER> psql`. For each item it records pass, fail or not-testable, and how it was checked. It also reviews the full diff, untracked files included, for bugs, missing locale keys, missing guards and unhandled errors. It fixes small problems itself and reports bigger ones.
- **QA-046** `MUST` Find and record the real root cause before fixing a UI symptom, rather than patching only the visible effect. Fix it at the shared layer so every affected instance is repaired, and also add a local defense where the symptom appeared. — _why:_ in one case an overlay opened in the wrong place because an ancestor had a permanent `transform`, which made it the containing block for `position: fixed`. The overlay itself was fine.
- **QA-047** `SHOULD` Reproduce state-dependent bugs by building the state directly (log out, call public endpoints, write fabricated localStorage, delete the server record), then reload the page.
- **QA-048** `GOTCHA` Some DTOs hide internal fields on purpose, depending on the role. Before treating a missing value as a bug, check it through the endpoint of a role that is allowed to see it.

## Browser verification of UI changes

- **QA-050** `SHOULD` Declare the dev servers in `.claude/launch.json` (backend, frontend, plus a frontend entry on an alternate port). Use them through the preview pane or the `run` skill to see UI changes working in a real browser.
- **QA-051** `MUST` Check every UI change in a browser at desktop (~1280 px) and mobile (375 px) width, in every supported locale. Look for horizontal overflow and console errors; there should be none (unverifiable checks: see WM-031).
- **QA-052** `SHOULD` Also check responsive layouts at intermediate widths (roughly 640–1100 px), and schedule visual QA on a real phone. — _why:_ a header that broke only in that range was a top-severity audit finding.
- **QA-053** `MUST` Automated browser tests run serially in Playwright Chromium (`--workers=1`) on a desktop project and an emulated phone (e.g. Pixel 7), in every supported locale.
- **QA-054** `MUST` Browser tests assert that the document has no horizontal overflow and that action controls fit inside their parent container, not just inside the document width. They also include a reflow check at 320 CSS px. — _why:_ an element can overflow its card while the page as a whole does not scroll sideways.
- **QA-055** `MUST` After every UI change, look at fresh screenshots and fix what you find before freezing. Scroll to the top before taking full-page captures, so sticky headers are not captured in the middle of the document.
- **QA-056** `SHOULD` Check UI changes with measurable DOM assertions. Examples: rendered grid and column widths, a panel that fits under a given viewport height, an overlay mounted on `body` that covers the viewport at deep scroll, an unchanged scroll position after close, and Escape closing dialogs.
- **QA-057** `SHOULD` Back statements about layout stability with a measured number (e.g. "0 of 40 items moved after appending a page"), not with the statement alone.
- **QA-058** `SHOULD` Build dev-only pages for visual iteration and QA of complex components (production-gated per SEC-096). Have them render the feature's persisted state as JSON, and use that as the assertion surface when screenshots or visual checks are impossible (see ENV-045 for why this is the only check path for canvas/WebGL in the embedded pane). — _why:_ it is the fastest reliable way to verify in a headless or hidden browser.
- **QA-059** `SHOULD` In browser tests, log in by calling the login endpoint with `fetch(..., { credentials: 'include' })` using seed or test accounts, instead of driving the login form.
- **QA-060** `SHOULD` Resilience e2e tests mock the API with `page.route`, seed storage with `addInitScript`, read expected UI strings from the locale JSON files instead of hard-coding them, assert that no page errors occurred, and cover:
  - fallback when a capability is missing
  - the dialog focus trap, with Escape closing it and focus restored afterwards
  - storage-quota and denied-storage errors
  - a slow or failed submit

  The submit cases assert six things: exactly one outgoing mutation, a disabled submit button, a status announcement (live region), a focused error, an available retry, and unchanged draft data.
- **QA-062** `SHOULD` When a heavy browser capability (e.g. WebGL) is unavailable, show a message and keep the rest of the editing UI working. Cover this with an e2e test that stubs `getContext('webgl')` to return `null` and asserts that no page errors occur.
- **QA-063** `MUST` Run authenticated journeys against real services only through a gated runner. The runner requires an explicit opt-in env var (`<ACCEPTANCE_OPT_IN_ENV>=1`), a local test DB URL, and a test password read from the environment, and it asserts that both the DB and the API hosts are local before doing anything. Use real auth cookies but never log tokens, and disable Playwright tracing so auth headers are not kept. Never rewrite seed accounts. Seed fixtures once per browser session, so that navigation cannot hide data loss.
- **QA-064** `MUST NOT` Never automatically repeat an uncertain mutation in an acceptance run. Clean up a failed attempt through the real API, and keep its leftover records clearly identifiable. — _why:_ a blind retry can duplicate side effects.
- **QA-065** `MUST` Every UI change meets minimum accessibility: labels on all inputs, visible focus states, and dialogs that close on Esc and on overlay click. Custom interactive controls are keyboard-accessible (e.g. arrow-key navigation in lightboxes, alongside the buttons).

## i18n and error-message parity

- **QA-066** `SHOULD` After editing locale JSON files, check that every locale file still parses (e.g. `node -e` with `JSON.parse` on each one). Inspect the existing key tree before referencing new keys.
- **QA-067** `MUST` Run an i18n parity check with a script in every sprint. Flatten all locale catalogs, require equal key counts with zero keys missing on any side, grep the terms banned by the product owner down to 0, and record the counts. When you change existing copy, update any Playwright tests that use the literal labels as selectors in the same commit. — _why:_ typecheck does not catch missing or wrong keys.
- **QA-068** `SHOULD` Keep a test that every API-error namespace has identical keys in all locales and that every key is a real code from the shared error-code registry. — _why:_ missing translations and typos in error codes are caught at test time.
- **QA-069** `SHOULD` Keep a test that ICU arguments in long legal texts are limited to an allowlist (placeholder ban: SEC-114; key parity: QA-067).
- **QA-070** `MUST` Every frontend query renders its error state, every mutation shows its error, and no catch block is empty. Every user-facing error code the backend throws has a translated message rather than a generic fallback. — _why:_ errors that were never rendered showed users blank pages, and uploads disappeared without a word.

## Acceptance checklists and honest reporting

- **QA-072** `MUST` The manual test plan and acceptance checklist required by the delivery contract (03, items 8-9) are checked by a human at the end of every sprint, using the seed scenarios as live test scripts. Each ticked item carries its evidence in parentheses: what was observed in the browser preview, or which tests cover it. Leave every item that was not executed unticked, with its concrete blocker (environment, missing data, needs an owner decision) and what covers it instead (unit or component test, curl). — _why:_ the checklist is what the owner trusts; one false tick makes every tick suspect.
- **QA-074** `MUST NOT` Never treat a phase as complete because its code exists. — _why:_ done means verified.
- **QA-105** `MUST` Open `<VERIFICATION_LEDGER>` at the start of the work with the base SHA and the pre-existing changes, then append every verification run to it with the exact command, the outcome, the scope and the checks still remaining. — _why:_ a running record keeps the next session honest about what was actually exercised.
- **QA-075** `MUST` Report test totals faithfully. List regular tests separately from gated real-service tests, never count skipped gated suites as passes, and never add overlapping focused runs together into a new total. — _why:_ inflated or double-counted numbers misrepresent coverage.
- **QA-076** `MUST` State what each piece of evidence covers. Browser tests with intercepted APIs say nothing about backend health or authenticated flows, and the durations of functional tests are not performance benchmarks. — _why:_ this keeps reports from overstating readiness.
- **QA-077** `MUST` Record what was not covered (other browsers, screen readers, physical devices, every branch, offline or slow networks) as explicit remaining gaps, and never imply certification. If a browser engine is missing locally, record the gap instead of silently downloading one.
- **QA-078** `SHOULD` Close a feedback round with a verification section, placed before the items waiting on the product owner. It lists typecheck, lint and test results with counts, the result of the production build, and an end-to-end run of each changed flow with what was observed. Drive those runs through the API with a test account.
- **QA-079** `SHOULD` Close a series of sprints with a full production build, an end-to-end run of the main user flow, and a pass over the admin area.

## Seed data as test scripts

- **QA-080** `MUST` Seeds are idempotent: they can be re-run without creating duplicates because they upsert on natural keys (e.g. email, tax ID).
- **QA-081** `MUST NOT` Seeds must not call external APIs (e.g. geocoding). Hardcode values such as the coordinates of seeded locations.
- **QA-082** `MUST` Seed scenarios use named, realistic personas instead of "Test User 1". Together they cover every status of each main entity, including edge states (pending, rejected, suspended, expired, auto-escalated). When `<SEED_SCENARIOS_DOC>` gives distributions (count per status, coverage per category), match the totals exactly; pair dimensions freely only where the doc allows it. — _why:_ a demo full of "Test X 1" does not convince anyone, while named scenarios let you demonstrate specific flows.
- **QA-107** `MUST` Derive seed data through the real domain services, so locks, ledgers and state transitions hold. Use direct inserts only for history rows (audit entries, notifications, past events), with realistic past timestamps. — _why:_ seeds that bypass the services can produce states the app could never reach.
- **QA-106** `SHOULD` Preload realistic history (e.g. at least 50 audit entries and 30 in-app notifications, the decorative notifications seeded as already read) and, where a business calendar exists, a multi-year public-holiday table including movable holidays. — _why:_ unread decorative notifications looked like real duplicates that users could not clear.

## Performance measurement

- **QA-083** `MUST` Measure performance with named fixtures that are validated against the current schema. Use the same host, browser and method every time, and run serially with nothing else running. Record the environment (renderer, viewport, DPR, throttling, dev or prod build), and use a reproducible tool that writes a report after each sample. State the method with each number (e.g. median of N warm requests for TTFB, statements per transaction via `log_statement=all`, slow-query WARN lines in the backend log, OPS-070), and flag environments that are not representative. — _why:_ without a fixed method and environment, numbers from different runs cannot be compared.
- **QA-084** `MUST` Say exactly what a metric measures. For example, animation-frame intervals are not GPU time or FPS, and approximate heap is not retained heap. Never generalize a speedup measured on specific fixtures into an across-the-board claim; state which fixtures and metrics improved and which did not. Keep the rejected runs, and name the single accepted run.
- **QA-087** `SHOULD` Choose performance budgets (frame time, payload, memory) from measurements on named small and large fixtures and devices before rollout, with modest headroom over the observed values. Present them as regression budgets, never as device targets, and never promise a frame rate that was not tested. Before release, require a separate acceptance run on real devices with a production build. Do not infer hardware performance from software-rendered emulation.
- **QA-088** `SHOULD` Give interactive or visual sprints a measurable acceptance target, chosen from measurement as in QA-087. An example is fluid updates at `<FPS_DESKTOP>` on desktop with a lower floor of `<FPS_MOBILE_FLOOR>` on mid-range mobile.
- **QA-089** `SHOULD` Check the lifecycle of heavy client resources (GPU buffers and textures, rendering contexts). Repeated open/edit/close cycles should settle at a stable allocation plateau, and closed contexts should end with zero live allocations.
- **QA-090** `SHOULD` Measure production payload from the built image, as decoded and encoded bytes per page and per referenced asset. Keep these numbers separate from compiler size estimates, and record lazy chunks as excluded.

## Security close

Run the security-close checklist in SEC-001/SEC-002 (chapter 06) at the end of every sprint and before every commit; a FAIL blocks closure. The pre-deploy security-review run (0 HIGH, 0 MEDIUM) is SEC-118.

## Release verification

- **QA-098** `MUST` Gate releases on a clean Linux/container production build plus smoke checks of startup, static assets and health.
- **QA-099** `MUST` Validate the production images end to end before deploying and again afterwards: register, the email arrives in the mail sink, verify, login sets cookies, then `/me`. Also check that the health endpoint reports each dependency (DB, Redis, storage) as up through the proxy.

The exact-SHA CI gate, the post-deploy smoke test, data-move verification and the restore test are in chapter 09; the client-IP spoofing probe and the noindex header for non-canonical hosts are in chapter 06.

## Adapting to a new project

- Map the gate commands (QA-001…QA-005) to your package manager and workspace names, and make sure every package has its own `lint`, `typecheck` and `test` scripts before relying on a green run.
- Fill in `<CI_DB_SERVICE_HOST>`, `<TEST_COMPOSE_PROJECT>` and the test env var names, and write the host guard (QA-027) before the first integration spec.
- List your critical paths (concurrency, money, auth, webhooks, time-based jobs, lifecycle transitions). They drive QA-015, QA-032 and the folders that get coverage-ratchet thresholds (QA-034).
- Decide the supported locales, the desktop, mobile and intermediate widths, and the emulated device for browser verification. Set `<BUSINESS_TZ>` for deadline tests.
- Create `<VERIFICATION_LEDGER>`, `<SEED_SCENARIOS_DOC>` and the acceptance-checklist template, and link them from the project instructions. The security-close checklist is set up per chapter 06.
- Choose the performance fixtures, the measurement environment and any `<FPS_DESKTOP>`/`<FPS_MOBILE_FLOOR>` targets, and measure them before you commit to budgets.
- Decide the release gates (see 09: OPS-031 exact-SHA CI gate, OPS-059 smoke, OPS-082 restore test): the clean production build with its startup, static-asset and health smoke checks (QA-098), and the end-to-end image validation journey and its mail sink (QA-099).
