# Stack conventions: NestJS + Prisma + Next.js

This chapter covers how code is written in a TypeScript monorepo with a NestJS + Prisma + PostgreSQL backend, a Next.js App Router frontend and a shared package for types and validation. It also covers the libraries around them: BullMQ, TanStack Query, Zustand, React Hook Form + Zod, next-intl, Tailwind + shadcn/ui, React Three Fiber and Jest.
To reuse it in a new project, keep the rules as they are, replace each `<PLACEHOLDER>` with your project's value, and delete any section for a library you don't use. The version-specific GOTCHA entries are true for the versions named. Check them again whenever you upgrade.

## Monorepo layout and tooling

- **STK-001** `SHOULD` Use a single pnpm-workspace monorepo with this layout:
  - `apps/backend`: NestJS + Prisma + PostgreSQL.
  - `apps/frontend`: Next.js App Router.
  - `<SHARED_PKG>`, e.g. `packages/shared`: shared TS types, Zod schemas and error-code constants.
  - `dev-infra/`: Docker Compose with Postgres, Redis, S3-compatible storage such as MinIO, and a local mail catcher such as Mailpit.

  Keep dev/build/test scripts at the root. Keep each `apps/*` separable so it can be extracted later without refactoring. — _why:_ an AI agent works much faster in one workspace, because migrations, shared types and end-to-end tests need no cross-repo sync.
- **STK-002** `SHOULD` Fix the stack in `<VISION_DOC>` and don't change it mid-project:
  - NestJS + Prisma + PostgreSQL 16+.
  - Next.js App Router + React + next-intl.
  - Tailwind + shadcn/ui.
  - React Hook Form + Zod.
  - TanStack Query v5 and Zustand.
  - Socket.IO with the Redis adapter.
  - BullMQ + Redis.
  - `@aws-sdk/client-s3`, with MinIO in dev.

  Pin exact versions in the lockfile and `.node-version`.
- **STK-003** `SHOULD` Run per-package scripts through pnpm workspace filters, e.g. `pnpm -F backend dev|test` and `pnpm -F frontend dev` (the commands section of CLAUDE.md is defined in SOT-034).
- **STK-004** `GOTCHA` Frontend and backend compile against the shared package's built `dist`, so build order matters:
  - On a clean checkout and in CI, run `prisma generate` and build the shared package before typecheck (gate order: QA-002).
  - After changing the shared package, rebuild it with `pnpm -F <SHARED_PKG_NAME> build`, then restart the backend dev server, because it keeps the old dist in memory. Only then typecheck. ENV-027 covers the Jest caveat (passing unit tests don't prove typecheck sees the new types).
- **STK-005** `GOTCHA` ESM-only packages break a CommonJS backend build. Load them through a dynamic `import()` wrapped in `new Function`, so TypeScript doesn't emit `require()`. Never add a global pnpm override that moves a dependency to an ESM-only major.

## Naming and language

- **STK-006** `MUST` Naming: snake_case for database objects, camelCase for TypeScript identifiers, PascalCase for classes and components.
- **STK-007** `MUST` Write code, identifiers, table names and endpoint paths in English, even when the UI and docs are in another language.
- **STK-008** `SHOULD` Write code comments in `<WORKING_LANGUAGE>` without diacritics (ASCII only), and only where they actually help.

## NestJS backend

- **STK-009** `MUST` Expose business APIs as REST under `<API_PREFIX>` (default `/api/v1`, set via `setGlobalPrefix`). Use WebSocket only for realtime pushes.
- **STK-010** `MUST` Each backend module lives in `modules/<name>/` and contains:
  - `<name>.module.ts`, `<name>.controller.ts` and `<name>.service.ts`.
  - `dto/`.
  - `guards/`, only if the guards are specific to this module.
  - `events/`, for payload types.
  - `<name>.errors.ts`.

  Processors, constants, helpers and `*.spec.ts` files sit next to the code they belong to.
- **STK-011** `MUST` Controllers stay thin: DTO validation plus one service call. They contain no business logic, no direct ORM access and no realtime/socket emits.
- **STK-012** `SHOULD` Make infra services `@Global()` modules: Prisma, the Redis client token, storage, mail, queues, calendar, event bus, settings and audit. `main.ts` does this setup:
  - sets the global prefix
  - registers the global exception filter
  - installs the Socket.IO Redis adapter
  - calls `enableShutdownHooks()`
- **STK-013** `MUST` Register the global `ValidationPipe` (flags per SEC-038) in the foundation step, before the first endpoint. DTOs and params follow these rules:
  - DTOs follow the validation source chosen under STK-016: class-validator classes, or DTOs generated from the shared Zod schema (e.g. nestjs-zod). Either way, every string has an explicit max length, e.g. email 254 and password 72 (the bcrypt limit).
  - Id route params use `ParseUUIDPipe`, so a non-UUID `:id` comes out as the 400 validation error code, never a 404 or 500.

  SEC-038 and SEC-030 cover the rest of request validation.
- **STK-014** `MUST` Register global guards in the order defined in SEC-026. Resource-scoped guards run per controller via `@UseGuards`. They attach a typed context to the request, which later guards and a `@CurrentX()` param decorator read.
- **STK-015** `GOTCHA` With `forbidNonWhitelisted`, extra fields such as `id` in a PATCH body return 400. Strip them on the frontend (`const { id, ...body } = v`) and always show save errors in the UI. — _why:_ saves failed every time with no visible error, so users believed their changes were saved.
- **STK-016** `AVOID` Don't keep the same validation in both shared Zod schemas and backend class-validator DTOs, because the two drift apart. Pick one source of truth: either Zod end to end (e.g. nestjs-zod), or reduce the shared package to types. SEC-038 (class-validator mirrored by Zod) is the fallback until this decision is recorded.
- **STK-018** `GOTCHA` NestJS routing has three traps:
  - Declare static routes before `@Get(':id')`.
  - To expose one **public** handler inside a controller that has a class-level `@Roles(...)`, use `@Public()` together with an empty `@Roles()`. `@Public()` alone only skips the JWT guard. The roles guard (`getAllAndOverride`) still applies the class role and returns 403. To change the required role on one handler, put a different `@Roles(...)` on the handler instead.
  - Import the auth module wherever an optional JWT guard needs `JwtService`.
- **STK-019** `GOTCHA` NestJS 11 / Express 5 changed two things:
  - The query parser is "simple", so `a[b]=` and `a[]=` are no longer parsed into objects.
  - Wildcard routes need a name: use `{*path}`, including in middleware `forRoutes`. The legacy `'*'` triggers the LegacyRouteConverter on every boot.

  Check DTOs before upgrading, and roll the upgrade out per OPS-061.
- **STK-020** `GOTCHA` With `@nestjs/throttler` v6, put custom tracker logic in a `ThrottlerGuard` subclass that overrides `getTracker`. Don't also set a module-level `getTracker`, because it overrides the method.
- **STK-021** `AVOID` Don't use Redis-version-specific command flags (e.g. `PEXPIRE NX`) until you have confirmed the production Redis version.
- **STK-022** `MUST` **Notification emails** are rendered in the backend in the recipient's stored locale, HTML-escape every interpolated value (SEC-043) and honour the opt-out plus the unsubscribe link (ENG-057, SEC-117). Transactional and security emails, such as verification, password reset and account block, ignore the opt-out. Don't swallow SMTP errors on the per-recipient retry path.

## Prisma schema and migrations

- **STK-023** `MUST` Prisma naming conventions:
  - Models are PascalCase with `@@map("snake_case_plural")`.
  - Fields are camelCase with `@map("snake_case")`.
  - Enums are PascalCase with `@@map` and UPPER_SNAKE values.
  - Ids are `String @id @default(uuid())`.
  - Every `DateTime` is `@db.Timestamptz()`. `createdAt` uses `@default(now())` and `updatedAt` uses `@updatedAt`.
- **STK-024** `MUST` For every schema change, run these steps in order and don't continue until each one passes:
  1. `prisma validate`.
  2. `prisma migrate dev --name <scope_description>`, using a descriptive snake_case name. In a non-interactive agent shell, `migrate dev` fails without a TTY. Use the ENV-030 sequence instead: create a new timestamped folder (check the newest existing migration first, ENV-031), generate its SQL with `prisma migrate diff ... --script`, then run `prisma migrate deploy`.
  3. `prisma generate`.
  4. Typecheck.
- **STK-025** `MUST NOT` Edit a migration that has already been applied. Every change is a new migration.
- **STK-026** `MUST` At minimum, index these columns:
  - foreign keys used in filters
  - geo-coordinate columns, if the app runs proximity/radius queries
  - deadline/expiry columns that jobs scan
  - the idempotency-key store, on `(key, endpoint)`
- **STK-027** `SHOULD` Add new columns to populated tables as nullable or with a default. Prefer additive changes with no backfill, where old rows stay NULL and the code handles NULL explicitly. Backfill only when necessary, and only inside the same migration.
- **STK-028** `GOTCHA` Prisma can't model CHECK constraints, partial unique indexes or append-only triggers, so they live only in hand-written SQL migrations. Anything that builds the schema from `schema.prisma` instead of replaying migrations omits them: `db push`, or a baseline or squashed migration generated with `migrate diff --from-empty --to-schema-datamodel`. A newly generated migration (`migrate dev`, or `migrate diff --to-schema-datamodel`) can also propose `DROP INDEX` for the SQL-only partial indexes; delete those lines by hand before applying it. Protect them:
  - Put sentinel comments in `schema.prisma` next to the affected models.
  - Explain each one in its migration.
  - Create indexes idempotently (`CREATE UNIQUE INDEX IF NOT EXISTS`).
  - Never delete them.
  - After every new migration, run `migrate status`, then a `migrate diff` from DB to schema. It must be empty apart from proposed DROPs of these documented SQL-only objects, and those DROPs are never applied.
- **STK-029** `SHOULD` Add a CHECK constraint to a populated table as `NOT VALID`. Run `VALIDATE CONSTRAINT` in a later migration, once a query confirms zero violating rows. On production, follow OPS-037 (pre-check on production and a backup before `VALIDATE`).
- **STK-030** `GOTCHA` PostgreSQL enums have two limits:
  - Put `ALTER TYPE ... ADD VALUE` in its own migration, because the new value can't be used in the same transaction.
  - Enum values can't be dropped, so a rollback means leaving the value unused. Mark dead values as "reserved" in `<DATA_MODEL_DOC>` instead of removing them.
- **STK-031** `MUST` When you add an enum value, grep for its neighbouring values across frontend and backend to find hard-coded lists: tab filters, badge tones, `status in [...]` checks, service constants and sweep/job filters. Add i18n keys in every namespace that translates the enum. — _why:_ a missing key shows the raw i18n key on screen.

## Prisma at runtime

- **STK-032** `GOTCHA` Prisma's interactive-transaction default timeout is 5 s and surfaces as P2028. The `runTx` profiles (ENG-003) own `maxWait`/`timeout`, the filter maps P2028 to a retryable 503 (ENG-006) that the client retries once with the same key (ENG-019), serialization failures (P2034) end as a retryable 409 (ENG-004), and ENG-012 covers batching with `createMany`. Side effects inside retrying callbacks follow ENG-005, and defensive writes that must survive a throw follow ENG-011.
- **STK-034** `GOTCHA` Raw SQL traps:
  - Prisma `String @id` columns are TEXT, not uuid, so don't cast with `::uuid`.
  - Cast enum columns to `::text` when comparing them with joined text parameters (`Prisma.join`).
  - Raw queries return snake_case column names. Alias them where the code expects camelCase.
  - On a partial unique index, P2002 `meta.target` lists the index's columns, not the index name.

## BullMQ workers

- **STK-035** `MUST` Use one queue per domain. Name jobs `verb.entity`, e.g. `expire.reservation`. Export queue names as constants from one global `QueuesModule`.
- **STK-036** `MUST` Job defaults are `attempts: 3`, exponential backoff of 2000 ms and `removeOnFail: 1000`. Failed jobs stay visible in an admin jobs view. Jobs that move money, such as refunds, write to the audit log.
- **STK-037** `SHOULD` Add repeatable jobs in `onModuleInit` with stable keys and staggered cron minutes. Add a heartbeat that re-arms them after Redis loses its state.
- **STK-038** `GOTCHA` BullMQ silently ignores `add` when the jobId already exists. To retry a failed job, call `job.retry()`. A self-rescheduling job must use a different jobId from the one that is still active. Keep `:` out of custom jobIds.

## Shared package (types, Zod, error codes)

- **STK-039** `MUST` Validate user-submitted structures with one Zod schema from the shared package, used on the frontend and, if STK-016 chose Zod end to end, the same schema behind the backend DTO. With Zod end to end, extending the schema there needs no new backend validation code.
- **STK-040** `SHOULD` Shared package conventions:
  - Zod error messages are i18n keys (e.g. `'invalidEmail'`), not text.
  - Enums are exported as `as const` arrays with derived union types, and match the Prisma enums verbatim.
  - Everything is re-exported from `src/index.ts` and built with `tsc` to `dist`.
  - Tests run with Vitest on `src/**/*.test.ts`, which is excluded from the build.

## Next.js App Router

- **STK-041** `MUST` Components are server components by default. Make a component a client component only where it needs interactivity.
- **STK-042** `MUST` Put every user-facing route under `app/[locale]/`. The locale layout checks the param against `routing.locales` and calls `notFound()` if it doesn't match. `generateStaticParams` returns every locale.
- **STK-043** `MUST` Unknown paths need three files:
  - A pass-through root `app/layout.tsx`.
  - A root `app/not-found.tsx` with its own minimal html/body, with text in every locale, for paths outside the locale segment.
  - `app/[locale]/[...rest]/page.tsx`, which calls `notFound()` so unknown localized paths get the localized 404 inside the public shell.

  — _why:_ without the catch-all, Next skips the locale layout and renders the bare root 404 with no header and no i18n.
- **STK-044** `MUST` Error pages:
  - `app/[locale]/error.tsx` shows a localized message, a retry via `reset()`, a home link and the error digest as a reference id, and reports the error to the tracker. It deliberately renders without the app shell.
  - `app/global-error.tsx` has its own html/body and hard-coded text in every locale.

  — _why:_ the header reads the session and may be the cause of the error, and the i18n provider may be what failed.
- **STK-045** `MUST` Every app with public, indexable pages ships these:
  - `robots`, which disallows private prefixes under every locale prefix.
  - `sitemap`, icons and `metadataBase`.
  - Per-locale `generateMetadata` with page titles.

  Keep one `PUBLIC_PATHS` list that feeds both the sitemap and hreflang. Each public page builds complete metadata through a helper: absolute title, description, canonical, hreflang for every locale plus `x-default`, and full openGraph.
- **STK-046** `GOTCHA` Next.js doesn't deep-merge `openGraph` between a layout and a page. The root title template also doesn't carry through intermediate layouts that set their own title. Declare the full openGraph on each page and build the title yourself as `title: { absolute }`.
- **STK-047** `MUST` Wrap pages that call `useSearchParams` in Suspense: the default export renders `<Suspense><Inner /></Suspense>`.
- **STK-048** `GOTCHA` In Next.js 15, `params` is a Promise in server components and `generateMetadata`, so always `await` it.
- **STK-049** `GOTCHA` A route handler file may export only handlers and route options. Put helpers and module state, such as rate limiters, in `lib/`. — _why:_ extra exports make `next build` fail type-checking, which blocks the image build.
- **STK-050** `SHOULD` For a pnpm monorepo container build, configure `next.config` with:
  - `output: 'standalone'`
  - `outputFileTracingRoot` at the workspace root
  - `transpilePackages` for the shared workspace package
  - `poweredByHeader: false`
- **STK-051** `SHOULD` In production, proxy the API and Socket.IO through Next rewrites to a server-only `BACKEND_INTERNAL_URL`, so the frontend and API share one origin. Leave it empty in development so the frontend talks to the backend port directly. — _why:_ SameSite=Lax cookies keep working with no cross-site CORS.
- **STK-052** `GOTCHA` When Next rewrites proxy Socket.IO, set `skipTrailingSlashRedirect: true`. Give `/socket.io/` its own rewrite next to `/socket.io/:path+`. Even then the websocket upgrade may fail through the proxy and the client stays on long-polling. Polling works, so don't treat it as an outage. — _why:_ without these settings, Next 308-redirects away the trailing slash, engine.io returns 404, and the WebSocket handshake doesn't follow redirects.
- **STK-053** `SHOULD` Client-protected pages redirect in a `useEffect` when the user query errors (`router.replace('/login')`). They render a placeholder while the user query is pending or errored. Backend guards remain the real enforcement.
- **STK-054** `SHOULD` The "who am I" endpoint returns `200 { user: null }` for anonymous visitors, and the client turns `null` into a local 401 `ApiError`. Existing guards (`me.isError` → redirect to login) then keep working, and anonymous visits don't trigger a failed token refresh.
- **STK-123** `MUST` Next.js specifics of the per-request CSP (SEC-093): the middleware sets the policy on the forwarded request headers (`x-nonce` and `content-security-policy`) as well as on the response, and the root layout and the root 404 force dynamic rendering, so Next stamps the nonce on its own scripts. — _why:_ a statically rendered page has no per-request nonce, so the CSP blocks its own scripts.

## API client and error handling

- **STK-055** `GOTCHA` Route all HTTP calls through one `api<T>()` fetch wrapper that sets `credentials: 'include'`. Spread `init` first, then set headers explicitly as `{ 'Content-Type': 'application/json', ...init.headers }`. — _why:_ when `init` was spread after a headers object, any call that added its own header (e.g. `Idempotency-Key`) replaced the whole headers object. Content-Type was dropped and the server got an empty DTO.
- **STK-056** `MUST` The wrapper never calls `res.json()` blindly. It parses JSON only when the body has text and returns `null` for 204 and for empty 200/201 responses (NestJS handlers that return `void`/`null`). Query functions for endpoints that can return nothing also normalize with `?? null`. — _why:_ `res.json()` throws on an empty body, so a successful write looked failed and invalidation never ran. TanStack Query v5 also rejects `undefined` as query data.
- **STK-057** `MUST` The api client parses the ENG-090 envelope into `ApiError(code, status, message, details)` and falls back to a generic internal-error code. UI text is looked up by `apiErrors.<CODE>` (ENG-094).
- **STK-058** `SHOULD` Do authenticated binary downloads through a session-aware fetch (401 → refresh → retry) that returns a Blob. Save it through a temporary anchor and revoke the object URL after a delay. — _why:_ a plain `<a href>` gets a 401 once the short-lived access token expires. Revoking the URL immediately can cancel the download in some browsers.

## TanStack Query

- **STK-059** `SHOULD` Create a single `QueryClient` inside a client `Providers` component with `useState(() => new QueryClient(...))`. Set explicit defaults there, e.g. `staleTime: 30_000`, `retry: 1`, `refetchOnWindowFocus: false`.
- **STK-060** `MUST` Fetch API data only through TanStack Query v5, with one hook per resource in a single agreed folder (e.g. `features/<domain>/api/` or `hooks/use-<resource>.ts`). Exceptions: one-shot mount actions (STK-066) and authenticated binary downloads (STK-058). Both still go through the single api client. Query keys:
  - Are hierarchical arrays per entity family: `['entity', 'list']`, `['entity', id]`, `['entity', id, 'sub']`.
  - Include serialized filters.
  - Nest sub-resources under the parent key, so the parent's existing invalidations refresh them too.

  Every consumer renders loading, error and empty states, never a blank page on error.
- **STK-061** `MUST` After a mutation, invalidate every query family whose server-derived data could change, not only the resource you mutated. That includes detail keys, lists, dashboards and the parent entity's status. Invalidate locally in the mutation. Don't wait for a socket event. — _why:_ without this, detail pages and lists showed the old status, and realtime events arrive seconds after commit.
- **STK-062** `MUST` Do optimistic updates only through TanStack mutation callbacks, never through a client store:
  - `onMutate` cancels the affected queries, snapshots them and applies `setQueryData`. It takes the `Idempotency-Key` from the intent-scoped idempotent runner (ENG-018). It never creates a fresh UUID per `mutate` call, so a retry of the same intent reuses the key.
  - `onError` rolls back to the snapshot. For a set users can toggle quickly (save/unsave, add/remove), roll back by applying the inverse operation to the affected item only. Don't restore the whole snapshot (ENG-125).
  - `onSettled` invalidates.

  Use this for save/remove/move toggles so the control's state flips instantly. For sends, add the item with status `sending` and mark it failed, with a retry option, on error.
- **STK-064** `SHOULD` When a create or publish mutation succeeds, seed the detail query with `setQueryData` from the response before redirecting to the detail page. — _why:_ the redirect renders instantly from cache instead of refetching.
- **STK-065** `SHOULD` Poll only while a server-side async process is pending: `refetchInterval: (q) => pending ? 2000 : false`. Gate dependent queries with `enabled: !!id`. Turn retry off for auth-gated or 404-prone queries. — _why:_ polling a resource that will 404 once its state changes fails forever.
- **STK-066** `GOTCHA` Per-call `mutate(vars, { onSuccess })` callbacks are dropped when the observer unmounts first, e.g. on the React StrictMode dev remount. Put must-run follow-ups in `mutateAsync().then(...)`. For one-shot mount actions, such as verify or unsubscribe pages, call the api function directly and keep the result in `useState`. Don't drive them from `useMutation` state. — _why:_ records were created but the follow-up that stored their tokens never ran.
- **STK-067** `MUST` Socket handlers only signal the cache. They run targeted `invalidateQueries` on the affected query families and never hold or write data in a separate store (ENG-126). The REST API stays the source of truth. Pair every `s.on` with a matching `s.off`. Give dashboard queries different `staleTime` values. Badges and counters read straight from the query cache.

## Client state: Zustand and browser storage

- **STK-070** `SHOULD` Follow the state boundaries in `<STATE_CONVENTIONS_DOC>` (ENG-123, ENG-124). Persist a wizard's local draft to localStorage only when an anonymous draft must survive reloads, and clear the local draft after a successful submit, because the server is then the source of truth.
- **STK-071** `MUST` Persisted Zustand stores use:
  - a namespaced key with a version suffix
  - a numeric `version`, bumped whenever the shape changes
  - a `migrate` function that normalizes old snapshots
  - a `partialize` whitelist of persisted fields

  Apply the same normalizer on every way data enters the store: local migrate, server resume and edit mode. Pure UI preferences, such as panel positions, may be persisted but stay out of undo history and data snapshots. Logout and user-switch cleanup of these stores follows SEC-018 and ENG-127. — _why:_ old shapes keep loading after schema changes, however they enter the store.
- **STK-072** `MUST NOT` Persist large binary blobs (data URLs, canvas snapshots) in the persisted draft. Keep blobs in memory only and out of server-side draft backups. Store a draft's resume token (the server id or handle of an anonymous draft) under its own key, never inside the draft blob. Auth tokens never go to browser storage (SEC-004), and idempotency keys stay in memory (ENG-018). — _why:_ blobs push both localStorage and the server snapshot past any reasonable size limit.
- **STK-073** `GOTCHA` For stores with async persisted storage, check `persist.hasHydrated()` and `await persist.rehydrate()` before calling `set()`. — _why:_ hydration that finishes later overwrites any earlier `set()`.
- **STK-074** `MUST` Wrap every localStorage read and write in try/catch through small `safeGet`/`safeSet`/`safeRemove` helpers. Storage can be missing, blocked or full (private mode, quota). These helpers are for non-critical keys only (preferences, one-time cleanup). Persisted draft stores use the versioned adapter from ENG-102, which reports failures instead of swallowing them.
- **STK-075** `SHOULD` When a build stops using a client storage key, ship a one-time cleanup that removes the leftover keys, e.g. an effect in `Providers`.
- **STK-076** `SHOULD` Implement undo/redo as history/future stacks in the store, recorded once per user gesture rather than per intermediate update. Bulk operations (undo, redo, load snapshot) increment a non-persisted counter so subscribers can ignore them.

## Forms: React Hook Form + Zod

- **STK-077** `MUST` Build forms with React Hook Form and `zodResolver`, using the schema from the shared package (and, if STK-016 chose Zod end to end, the same schema behind the backend DTO). Never write a second, frontend-only copy of a shared schema. Also:
  - Render Zod messages as i18n keys, e.g. `t(\`validation.${error.message}\`)`.
  - Mark forms `noValidate`.
  - Load per-field permissions from the API via TanStack. Fields the user may not edit render as read-only text, not as disabled inputs (PO-059).

  — _why:_ the form validates exactly what the API will accept.
- **STK-078** `GOTCHA` `z.coerce.number()` turns an empty input into `0`, so an optional `.positive()` field fails silently and the form never submits. Use `z.preprocess` to turn `''` into `undefined` instead.
- **STK-079** `MUST` While a submit is pending, disable the button so it can't be sent twice, and show a `role="status"` indicator. On failure, move focus to the `role="alert"` error and keep the local draft intact.
- **STK-080** `SHOULD` Use a shared `Field` wrapper that ties the label to the control programmatically. It generates an id with `useId` and clones it onto the first child when the caller didn't pass one. Hide the hint while an error is shown. — _why:_ labels had an empty `htmlFor` before this, which broke accessibility.
- **STK-081** `SHOULD` Numeric inputs that clamp keep a local draft string while the user types. Clamp and commit only on blur or Enter. Escape cancels, and an empty field reverts to the previous value. — _why:_ clamping on every keystroke makes it impossible to type intermediate values.

## Internationalization: next-intl

- **STK-082** `MUST` Every UI string goes through next-intl keys. Never hard-code UI text in TSX. Add each key to every locale file (`<LOCALES>`) in the same change, with identical key trees (checked by QA-067), in the page's existing namespace. This includes aria labels, role labels and page metadata. Copy rules such as tone and diacritics follow PO-034. The only exceptions are the root `app/not-found.tsx` and `app/global-error.tsx`, which sit outside the provider and are edited by hand in every language.
- **STK-083** `GOTCHA` next-intl message keys must not contain dots. A dot causes an `INVALID_KEY` error on every page.
- **STK-084** `SHOULD` Messages:
  - Write plurals as ICU messages, with every plural category each locale needs.
  - Use `t.rich` for links inside sentences.
  - Call `t.has(key)` before rendering a dynamically built key.
- **STK-085** `SHOULD` Define routing once with `defineRouting` + `createNavigation`. Import `Link`, `useRouter`, `usePathname` and `redirect` from that module, not from `next/link` or `next/navigation`. — _why:_ locale-aware navigation keeps the locale prefix.
- **STK-086** `SHOULD` Locale detection is a product decision. When the product owner wants a fixed default language:
  - Set `localeDetection: false`.
  - Store only the user's explicit switch, in a `NEXT_LOCALE` cookie (1 year, SameSite=Lax).
  - Apply that cookie in middleware on `/`.
- **STK-087** `SHOULD` Display money with fixed two decimals via `Intl.NumberFormat` for the active locale. Take the currency unit from an i18n message instead of hard-coding it.
- **STK-124** `SHOULD` When the product supports more than one locale, ship every locale complete (STK-082) with a language switcher, store the user's language preference on the account (the explicit-switch cookie of STK-086 covers anonymous visitors), and render emails and PDFs in the recipient's stored preference (STK-022, ENG-132).

## Tailwind + shadcn/ui, styling and motion

- **STK-088** `SHOULD` Build UI with Tailwind + shadcn/ui, and make every screen responsive. Configure shadcn with CSS-variable color tokens and the standard `cn()` helper (clsx + tailwind-merge).
- **STK-089** `GOTCHA` If you add custom `fontSize` tokens, build `cn()` with `extendTailwindMerge` and register them in the `font-size` class group. — _why:_ otherwise tailwind-merge reads an unknown `text-*` class as a color, and `cn('text-<custom>', 'text-<color>')` silently drops the size.
- **STK-090** `SHOULD` Keep design tokens in `globals.css` and record type rules (which family is for data, which weights each font ships) in `<DESIGN_SYSTEM_DOC>`. Never apply a weight the loaded font doesn't ship, because browsers fake the bold. When a token's name no longer matches its meaning, add an accurately named alias, use it in new code and log a rename chore.
- **STK-091** `SHOULD` Load fonts with `next/font`, including the `latin-ext` subset when the primary language uses diacritics. Expose them as CSS variables and have Tailwind's `fontFamily` reference those variables.
- **STK-092** `GOTCHA` Any CSS transform that stays on an ancestor makes that ancestor the containing block for `position: fixed`. A page-enter or slide animation with `animation-fill-mode: both`/`forwards` leaves one on `<main>`. Don't use those fill-modes on transform animations, keep persistent transforms off layout shells, and portal overlays and lightboxes to `document.body` with a scroll lock. — _why:_ otherwise modals and lightboxes anchor to the top of the document instead of the viewport.
- **STK-093** `MUST NOT` Let navigation or first paint depend on an animation finishing. Render a complete static first paint.
  - Don't use exit animations (`AnimatePresence mode="wait"`) on the screens of a multi-step wizard. If the tab is hidden mid-exit, requestAnimationFrame pauses and the transition never completes.
  - framer-motion SVG elements whose geometry is set only in `animate` have no attributes until the first animation frame. For critical drawings and one-shot in-view effects, use plain SVG/CSS transitions on geometry properties (`x`, `width`, `d`).
  - Features driven by IntersectionObserver (reveal-on-scroll, lazy loading, infinite scroll) need a fallback that also works on interaction, such as a "load more" button, because the observer may never fire (ENV-042).

  — _why:_ the wizard froze for good, which on mobile looked like "I came back and it's stuck".
- **STK-094** `MUST` Honour `prefers-reduced-motion` everywhere:
  - A global media query collapses durations.
  - Elements that stay hidden until animated get explicit final states.
  - Apply "hidden until revealed" styles only through a class that JS adds after hydration.
  - Check the preference in JS-driven and 3D animations too.

  — _why:_ some browsers and extensions cancel animations outright, so `forwards` never applies and content stays stuck at opacity 0.
- **STK-095** `SHOULD` For infinite-scroll masonry, place each new item in JS into the currently shortest column. Each item's placement then depends only on earlier items, so appended pages never move existing items. Keep plain CSS columns for finite lists. — _why:_ CSS columns rebalance every card on each append, which causes layout shift.
- **STK-096** `SHOULD` Draw decorative connectors in a grid or bento layout as layout elements placed in the gutters, such as hairlines between cells and rows. Never draw them as free SVG over or under the cells. — _why:_ connectors drawn under the cells look fragmented and connectors drawn over them cut through text. Gutter elements can never touch content.

## Overlays, dialogs and interaction

- **STK-097** `MUST` A custom modal closes on a backdrop click only when the `pointerdown` also started on the backdrop. Alternatively, use Radix Dialog. Drag interactions handle `pointercancel`. — _why:_ a slider or orbit drag released over the backdrop threw away edits, and touch drags left ghost state stuck on screen.
- **STK-098** `GOTCHA` Implement body scroll locking as one module-level, ref-counted `lockBodyScroll()`. Never use independent save/restore pairs per component. Full-screen overlays and lightboxes render through `createPortal(..., document.body)` (STK-092 explains why), take this lock while open, and restore the exact scroll position when they close. — _why:_ pairs released out of order leave the body stuck on `overflow: hidden` for good.
- **STK-099** `GOTCHA` In a flex-column dialog with a fixed footer, give the scrolling region `min-h-0 flex-1`, or the footer is pushed out of view.
- **STK-100** `SHOULD` Keep an explicit z-index ladder: sticky header < fullscreen overlay < dialogs < top-level blocking modal (e.g. an onboarding or legal-acceptance gate). Place every new overlay in it on purpose. Replace native `prompt()` and `confirm()` with app dialog components.
- **STK-101** `MUST` Keyboard accessibility for custom widgets:
  - Custom (non-Radix) dialogs use a shared focus-trap hook with a dialog stack, so Escape and Tab affect only the topmost dialog and focus returns to the opener.
  - Tabs use a roving tabindex with Arrow/Home/End.
  - Clickable drop zones are `role="button"` and respond to Enter/Space.

  Cover all of this with keyboard tests.
- **STK-102** `MUST` Route irreversible actions through a shared confirm dialog that:
  - can't be closed while the action is pending
  - shows the API error inside the dialog
  - can require an acknowledgement checkbox that resets on every open

  The caller supplies all the texts.
- **STK-103** `SHOULD` Make blocking gates, e.g. re-accepting changed terms, non-dismissible dialogs:
  - no close button
  - Escape and outside clicks prevented
  - logout as the only exit
  - the referenced pages still readable

  If logout would throw away an unsubmitted local draft, ask for explicit confirmation first.
- **STK-104** `SHOULD` Keyboard shortcuts ignore `e.repeat` and events coming from dialogs or inputs. The page-level keydown handler returns early while a modal is open. — _why:_ otherwise destructive keys (Delete, arrows) act on content behind the modal.
- **STK-105** `MUST` In every mode or view, hide options that are impossible in the current state instead of showing them disabled (the UI layer of ENG-105), and hide a control entirely when its range collapses to one value.
- **STK-106** `SHOULD` Render async data through a shared `QueryState` primitive:
  - a skeleton while pending
  - a "slow, retry" error after a 15 s loading timeout
  - an error fallback with Retry

  Use a shared `EmptyState` for empty, error and blocked states, with a neutral, warning or error tone and `role="status"` or `role="alert"`. — _why:_ every loading and error state then looks and behaves the same.
- **STK-107** `SHOULD` For anything that depends on "now", such as deadlines and grace windows, use a ticking `useNow(interval)` hook so the UI updates without a reload. The relative-time formatter handles future times and treats anything less than 60 s ahead as "now". — _why:_ client/server clock skew otherwise shows nonsense like "in 0 minutes".

## React Three Fiber

- **STK-108** `SHOULD` When a parametric 3D object's kind changes, reset every piece of per-kind transient state, such as pivot rotations (`rotation.set(0,0,0)`) and open/expanded flags. Key pivot subtrees by role so React remounts them instead of keeping stale transforms.
- **STK-109** `MUST` Import every three.js / React Three Fiber component only through `next/dynamic(() => import(...), { ssr: false, loading })`:
  - Collect these imports in a dedicated `dynamic.tsx`.
  - Load them only on the screen that needs them.
  - Check WebGL availability before every canvas and show a useful fallback.
  - When the model is parametric, generate geometry procedurally instead of shipping assets, which keeps the bundle small.

  — _why:_ WebGL doesn't exist on the server, three.js (~160 KB gzip) must stay out of other pages' bundles, and a single canvas without a WebGL check crashed a public page.
- **STK-110** `SHOULD` Render canvases with `frameloop="demand"` and a capped `dpr` (e.g. `[1, 1.75]`). Call `invalidate()` on every content change. Compute tween progress from absolute elapsed time, `(now - start) / duration`, call `invalidate()` every frame until it reaches 1, and jump straight to the end under reduced motion. — _why:_ pauses in demand mode then don't speed up the next movement.
- **STK-111** `MUST` Dispose manually created geometries, materials and render targets in effect cleanups, and clean up listeners. Pass `dispose={null}` on `<primitive>` objects whose lifecycle you manage yourself.
- **STK-112** `SHOULD` To export a PNG snapshot of a canvas, render one frame on demand and call `toDataURL`. Don't enable `preserveDrawingBuffer`.
- **STK-113** `GOTCHA` Click and drag handling in R3F:
  - R3F click events pass through to objects behind, so call `stopPropagation` in clickable meshes' `onClick`. Otherwise a background mesh, such as a ground plane, handles the same click.
  - Count a pointer-up as a click only if `event.delta <= 3`.
  - Don't build drags on mesh pointer events. Use window-level `pointermove`/`pointerup` listeners and a raycast you build yourself from the camera (unproject NDC), recording one undo entry per gesture.

  — _why:_ a `stopPropagation` in another mesh's `onPointerOver` stops `pointermove` delivery mid-gesture and kills the drag.
- **STK-114** `GOTCHA` R3F major versions are tied to React majors: fiber v8 + drei v9 on React 18, and fiber v9 requires React 19. Upgrade them together.

## Testing (Jest / Vitest)

- **STK-115** `SHOULD` Give shared UI components (`components/ui/*`) their own i18n namespace, and wrap their tests in `NextIntlClientProvider`.
- **STK-116** `GOTCHA` Radix/floating-ui popovers make jsdom's `Element.prototype.matches` recurse heavily on `:popover-open`/`:modal`, costing about 30 s per open. Short-circuit those selectors in the test setup.

## Container build and runtime

For `NEXT_PUBLIC_*` values baked at build time, see OPS-019. Debian slim (bookworm) images need `openssl` before `prisma generate` in every client-generating stage: see OPS-017. ioredis and BullMQ connections on IPv6 private networking need the Redis password plus `family: 0`: see OPS-097.

- **STK-118** `MUST` When `prisma migrate deploy` runs at container boot:
  - Keep `prisma` in `dependencies`, not `devDependencies`.
  - Copy `schema.prisma` and the full migrations folder, including `migration_lock.toml`, into the runtime image.
- **STK-120** `SHOULD` For server-side PDF rendering with Puppeteer, use the distro Chromium instead of the downloaded browser:
  - `PUPPETEER_SKIP_DOWNLOAD=1` at install.
  - `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium`.
  - Install the fonts you need.
  - Launch with `--no-sandbox`.
- **STK-122** `SHOULD` Re-encode uploaded images (SEC-084) with sharp using `failOn: 'error'`, `limitInputPixels` at about 40 MP and `.rotate()` to apply the EXIF orientation, never `withMetadata()`, and run it with `sharp.cache(false)` and `sharp.concurrency(1)` in the worker. — _why:_ a corrupt file or a decompression bomb then fails fast instead of exhausting worker memory, and EXIF/GPS metadata never survives.

## Adapting to a new project

- Fill in the placeholders:
  - `<SHARED_PKG>` / `<SHARED_PKG_NAME>`
  - `<API_PREFIX>`
  - `<LOCALES>` and `<PRIMARY_LOCALE>`
  - `<WORKING_LANGUAGE>` for comments
  - `<VISION_DOC>`, `<STATE_CONVENTIONS_DOC>`, `<DATA_MODEL_DOC>` and `<DESIGN_SYSTEM_DOC>`

  Write the state-conventions doc before the first frontend feature.
- Decide the single validation source of truth early (STK-016 vs STK-013/STK-039): Zod end to end, or class-validator DTOs with a shared package that holds only types. Record the decision so it isn't reopened.
- Decide locale detection (STK-086) and the list of supported locales with the product owner before writing UI strings.
- Define the shared constants these rules assume:
  - the `runTx` transaction profiles (ENG-003, see STK-032)
  - BullMQ default job options and queue-name constants (STK-035, STK-036)
  - the error-code catalog and error envelope (ENG-090, STK-057)
  - the z-index ladder (STK-100)
- Delete the sections for libraries you don't use (React Three Fiber, Puppeteer, sharp, Socket.IO proxying); platform gotchas live in chapter 09 (OPS). Re-check every version-specific GOTCHA (Next 15, NestJS 11 / Express 5, throttler v6, R3F majors) against your pinned versions.
- Split these rules into per-area Claude skills (backend module, schema migration, queue worker, UI component) so each task loads only the relevant part, and link them from the project's CLAUDE.md along with the canonical commands (STK-003, SOT-034).
