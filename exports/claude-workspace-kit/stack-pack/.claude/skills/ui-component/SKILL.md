---
name: ui-component
description: Use this skill when creating or modifying React components, pages, forms, hooks, persisted stores, or TanStack Query queries/mutations in the Next.js App Router frontend ("componenta", "pagina noua", "formular", "hook", "UI", "ecran"). Also covers critical mutations with idempotency keys, API error mapping, Zustand state placement, socket-driven cache invalidation, a new third-party origin (CSP), a new public page (SEO) and lazy-loaded WebGL/3D canvases.
---

# UI component conventions

How frontend code is written in `apps/frontend` (Next.js App Router, shadcn/ui + Tailwind, TanStack Query v5, Zustand, React Hook Form + Zod, next-intl). Rule IDs point to the kit: WM = 01, DEL = 03, ENG = 04, QA = 05, SEC = 06, PO = 07, MEM = 08, OPS = 09, ENV = 10, STK = STACK-RULES.

## When to use

- New or changed component, page, layout, dialog, form or hook under `apps/frontend/src/`.
- A new query or mutation, especially a critical one (moves money, consumes a limited capacity, accepts/commits, cannot be undone).
- A new or reshaped persisted Zustand store or browser-storage key.
- A new realtime handler, third-party origin (script, image, connect, embed), public indexable page, or WebGL/3D canvas.
- Not here: endpoints (`nestjs-module`), schema (`prisma-migration`), the wording and locale work for new strings (`i18n-copy-change`). Browser proof runs in `ui-browser-verify`; closure runs `security-close`.

## Read first

- `docs/02-technical-invariants.md` (`<INVARIANTS_DOC>`): only the frontend state-boundary, idempotency and auth sections.
- `<STATE_CONVENTIONS_DOC>`: which state lives where (ENG-123, STK-070).
- `docs/07-decisions-log.md` (`<DECISIONS_LOG>`): decisions are final; never reopen them.
- `<ERROR_CODES_DOC>` and the error-code registry in `<SHARED_PKG>`, for every code the screen can receive.
- `<DESIGN_SYSTEM_DOC>`: tokens, type rules, z-index ladder (STK-090, STK-100).
- The domain's existing hooks file, the shared Zod schema, and the page's namespace in every locale file (`<LOCALES>`); inspect the key tree before adding keys (QA-066).
- If the project keeps a knowledge vault: the map note, the affected module notes and the matching IMPACT playbook (MEM-024).

## Procedure

1. **Declare scope** (DEL-006): pages, components, hooks, query keys read and invalidated, stores, new strings, and for each mutation whether it is plain or critical. A missing entity, field or rule → `DECISION NEEDED`, stop (WM-001).
2. **Component shape** (STK-041, STK-088): server component by default; `'use client'` only on the leaf that needs state, effects or handlers. Build from shadcn/ui primitives and Tailwind tokens via `cn()`; every screen responsive. Pages using `useSearchParams` render inside Suspense (STK-047); `await params` on Next 15+ (STK-048); navigation comes from the i18n routing module, not `next/link` (STK-085).
3. **Data hooks** (STK-060, STK-055, STK-056, STK-065): one hook per resource in the single agreed folder (e.g. `features/<domain>/api/` or `hooks/use-<resource>.ts`), every call through `api<T>()`. Keys are hierarchical arrays with serialized filters, sub-resources nested under the parent: `['<entity>', 'list', filters]`, `['<entity>', id]`, `['<entity>', id, '<sub>']`. Nullable endpoints normalize: `queryFn: async () => (await api<T | null>(path)) ?? null`. Gate dependents with `enabled: !!id`; poll only while a server process is pending; retry off for auth-gated or 404-prone queries.
4. **Mutations** (STK-061, STK-064, STK-066): on success invalidate every family whose server data may change (detail, lists, dashboards, parent status), locally, without waiting for a socket. After create/publish, seed the detail with `setQueryData` from the response before redirecting. Must-run follow-ups go in `mutateAsync().then(...)`.
5. **Critical mutations** (ENG-015, ENG-018, ENG-019, STK-062, ENG-032):
   ```ts
   const run = useIdempotentApi();   // the idempotent runner: in-memory UUID v4 per intent fingerprint (user + path + method + body)
   const m = useMutation({
     mutationFn: (v: V) => run<R>(`/<entity>/${id}/<action>`, { method: 'POST', body: JSON.stringify(v) }),
     onMutate: async () => {
       await qc.cancelQueries({ queryKey: key });
       const prev = qc.getQueryData(key);
       qc.setQueryData(key, optimistic);
       return { prev };
     },
     onError: (_e, _v, ctx) => qc.setQueryData(key, ctx?.prev), // quick toggles: inverse op on the item (ENG-125)
     onSettled: () => qc.invalidateQueries({ queryKey: ['<entity>'] }),
   });
   // <Button disabled={m.isPending || m.isSuccess}>
   ```
   One key per user click/intent, reused across retries of that intent, dropped after success or a definitive 4xx, kept in memory only. An uncertain purchase is never retried under a fresh key. Only a 503 "database busy" is retried automatically, once, same key, after `Retry-After`, with a "server busy, retrying" notice. Irreversible or paid actions go through the shared confirm dialog that shows the server-provided cost and consequences, has no option preselected and cannot close while pending (STK-102, SEC-048).
6. **Forms** (STK-077 to STK-081, STK-015): React Hook Form + `zodResolver(schema)` with the schema imported from `<SHARED_PKG>`, never redefined. Mark forms `noValidate`; Zod messages are i18n keys rendered as ``t(`validation.${error.message}`)``; labels through the shared `Field` wrapper. Fields the user may not edit render as read-only text, not disabled inputs (PO-059). Clamping numeric inputs keep a draft string and commit on blur or Enter. Strip read-only fields such as `id` before a PATCH. While pending: disabled submit plus a `role="status"` indicator; on failure: focus the `role="alert"` error and keep the draft.
7. **Errors and async states** (ENG-094, STK-057, STK-106, QA-070): show ``t(`apiErrors.${err.code}`)`` (guard with `t.has`), with the server `message` only as fallback; every reachable code gets a key in every locale. Render queries through `QueryState` (skeleton, slow-retry, error + Retry) and empty/blocked cases through `EmptyState`. No empty catch blocks.
8. **State placement** (ENG-123, ENG-124): API data stays in TanStack Query; Zustand holds pure UI state (modals, panels, UI filters, theme, pre-submit drafts); RHF holds in-progress fields. If API data seems to need Zustand, stop and ask.
9. **Persisted stores** (STK-071 to STK-075, ENG-102): namespaced key with a version suffix; bump `version` on every shape change and add a pure `migrate` normalizer applied on every entry path (rehydrate, server resume, edit mode); `partialize` as a whitelist. Reject unknown, future or corrupt data instead of overwriting it; the draft adapter reports storage failures instead of swallowing them, and non-critical keys go through try/catch `safeGet`/`safeSet` helpers. A major change moves to a new key and leaves the old copy for rollback; ship a one-time cleanup for keys no longer used. Register the store in logout/user-switch cleanup (SEC-018, ENG-127).
10. **Realtime** (STK-067, ENG-126): one Socket.IO client singleton (`withCredentials`); handlers only run targeted `invalidateQueries` on the affected families and never hold or write data, so the REST API stays the source of truth. Pair every `on` with an `off`. On an auth-expired event: disconnect, refresh the session, reconnect.
11. **New third-party origin** (SEC-093, SEC-094, OPS-019): add it to the central CSP builder (e.g. `lib/csp.ts`) in the same change, keeping the per-request nonce and `'strict-dynamic'`. Before narrowing an image or connect origin, check stored data read-only for hosts still in use. A configurable origin is a `NEXT_PUBLIC_*` value declared as `ARG` + `ENV` with a valid default in every Dockerfile and documented in `.env.example` (baked at build, so changing it needs a rebuild; never anything sensitive).
12. **New public page** (STK-045, STK-046): add the path to the single `PUBLIC_PATHS` list that feeds sitemap and hreflang, keep private prefixes disallowed in `robots`, add per-locale `Meta` title and description keys, and build metadata through the shared helper (absolute title, canonical, hreflang + `x-default`, full openGraph on the page). Dev-only pages call `notFound()` in production and their prefix is disallowed in `robots` (SEC-096).
13. **WebGL/3D canvases** (STK-109 to STK-111, ENG-117): import through `next/dynamic(() => import(...), { ssr: false, loading: () => <Fallback /> })` from a dedicated `dynamic.tsx`, only on the screen that needs it. Detect WebGL at mount and keep a working fallback (QA-062). Render with `frameloop="demand"` and a capped `dpr`; dispose manually created geometries, materials and render targets in effect cleanups.
14. **i18n and a11y** (STK-082 to STK-084, PO-032, PO-034, QA-065, STK-101, QA-054): every visible string is a key in every locale in the same change, no dots in keys, ICU plurals, glossary terms and the owner's tone; the copy work itself follows `i18n-copy-change`. Labels on inputs, visible focus states, dialogs that close on Esc and overlay click, keyboard-operable custom widgets, and reflow at 320 px with no overflow.
15. **Tests and close** (QA-002, QA-005, QA-023, QA-067): build `<SHARED_PKG>` → typecheck → lint (`--max-warnings 0`) → `pnpm -F frontend test` (Vitest, colocated `*.test.tsx`) → the relevant `test:e2e` spec → i18n parity script; re-run the whole sequence after any fix. Then run `ui-browser-verify`.

## Rules

- MUST fetch API data only through TanStack Query v5 and the single `api<T>()` client (STK-060).
- MUST NOT copy API data into Zustand, mirrored React state or browser storage; stop and ask instead (ENG-123).
- MUST NOT write a frontend-only copy of a shared Zod schema (STK-077).
- MUST send critical mutations through the idempotent runner; never mint `crypto.randomUUID()` inline per `mutate` call (ENG-018, STK-062).
- MUST do optimistic updates only in mutation callbacks, never through a store (ENG-125).
- MUST map errors by `code`, never by the server's message text (ENG-094).
- MUST NOT hard-code UI text in TSX; only the root `not-found` and `global-error` are hand-edited per locale (STK-082).
- MUST NOT put auth tokens, idempotency keys or binary blobs in browser storage (SEC-004, STK-072).
- MUST NOT make an irreversible or paid action a single click (SEC-048).
- MUST add every new external origin to the CSP builder in the same change (SEC-094).
- MUST NOT import WebGL/3D libraries statically (STK-109).
- MUST NOT let navigation or first paint wait on an animation; honour `prefers-reduced-motion` (STK-093, STK-094).

## Done checklist

- [ ] Scope declared; nothing invented.
- [ ] Server component by default; client components only where interactive.
- [ ] Hooks in the agreed folder, hierarchical keys, nullable endpoints `?? null`, every affected family invalidated or the detail seeded.
- [ ] Forms: shared schema via `zodResolver`, key-based messages, disabled pending submit, focused `role="alert"` error.
- [ ] Critical mutations: runner key, disabled button, `onMutate`/`onError`/`onSettled`, confirm dialog where irreversible or paid.
- [ ] Every reachable error code has `apiErrors.<CODE>` in every locale; `QueryState`/`EmptyState` used; no empty catch.
- [ ] No API data in Zustand; persisted stores versioned, `migrate` on every entry path, whitelist `partialize`, storage failures surfaced, logout cleanup.
- [ ] Socket handlers only invalidate query families; `on`/`off` paired.
- [ ] New origin in the CSP builder and `NEXT_PUBLIC_*` wiring; new public page in `PUBLIC_PATHS`, per-locale `Meta` keys, metadata helper.
- [ ] WebGL/3D canvas lazy-loaded with `ssr: false`, loading fallback, capability check, resources disposed.
- [ ] i18n parity green; a11y basics; 320 px reflow.
- [ ] Shared build, typecheck, lint (0 warnings), Vitest and the relevant e2e green, counts recorded; `ui-browser-verify` done with gaps listed as `UNVERIFIED` (WM-031).

## Pitfalls

- TanStack Query v5 rejects `undefined` as query data; an empty 200/204 must become `null` (STK-056).
- Spreading `init` after the headers object drops `Content-Type` once a call adds `Idempotency-Key`, so the server gets an empty DTO (STK-055).
- An `id` left in a PATCH body is a 400 under `forbidNonWhitelisted`; always show save errors (STK-015).
- `z.coerce.number()` turns an empty input into `0`; use `z.preprocess` (STK-078). `value || default` swallows a legal `0`; use `??` (ENG-109).
- Per-call `mutate(vars, { onSuccess })` is dropped when the observer unmounts, including the StrictMode dev remount (STK-066).
- Restoring a snapshot after two quick toggles cancels both; roll back with the inverse operation (ENG-125).
- Pruning client references against a list that is still fetching deletes valid ones; require `isSuccess && !isFetching` (ENG-129).
- With async persisted storage, a `set()` before hydration finishes is overwritten (STK-073).
- A dot in a next-intl key throws `INVALID_KEY` on every page (STK-083).
- Next.js does not deep-merge `openGraph`, and the root title template skips layouts with their own title (STK-046).
- CSP is enforced only in production, so a missing origin breaks only there; `NEXT_PUBLIC_*` values are baked at build (SEC-094, OPS-019).
- A transform left on an ancestor anchors `position: fixed` overlays to it; portal overlays to `document.body` (STK-092).
- Custom `fontSize` tokens need `extendTailwindMerge`, or `cn()` drops the size (STK-089).
- In the embedded preview pane, rAF is paused and WebGL does not render; verify through the DOM and report the rest as `UNVERIFIED` (ENV-042, ENV-045, WM-031).
- Fast Refresh remounts re-run mount effects, which can create phantom server records in dev (ENV-038).
